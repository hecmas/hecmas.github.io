---
title: "Computing the Optimal Ate Pairing over the BLS12-381 Curve"
summary: "A computation-first walkthrough of the optimal Ate pairing on BLS12-381: the extension-field tower, line equations, final exponentiation and cyclotomic tricks behind our zkASM implementation."
date: 2023-05-19
tags: ["Pairings", "Elliptic Curves", "Polygon zkEVM"]
draft: false
hackmd: "https://hackmd.io/4gg0L936QsGdvSwZOjonlQ"
---

The post [BLS12-381 For The Rest Of Us](https://hackmd.io/@benjaminion/bls12-381) constitutes the base point for this article, so I highly recommend reading it to get a solid background of the BLS12-381 curve. This post will reuse some parts with an emphasy on the computational aspect of the optimal Ate pairing over such curve. 

For those with a poor background on Pairing-Based Cryptography (PBC) but with a decent background on Elliptic-Curve Cryptoraphy (ECC) I recommend reading the following resources in order:
1. [Pairings For Beginners](https://static1.squarespace.com/static/5fdbb09f31d71c1227082339/t/5ff394720493bd28278889c6/1609798774687/PairingsForBeginners.pdf).
2. [Constructing Elliptic Curves with Prescribed Embedding Degrees](https://eprint.iacr.org/2002/088.pdf).
3. [BLS12-381: New zk-SNARK Elliptic Curve Construction](https://electriccoin.co/blog/new-snark-curve/).

Only after (and not before) you feel sufficiently comfortable with both PBC and ECC come back to this post and start to make sense out of it. The full list of consulted resources can be found at the [end](#resources) of this post.

The implementation in zkASM has been done in this [PR](https://github.com/0xPolygonHermez/zkevm-blob-rom/pull/14).

## The Curve

The BLS12-381 is the elliptic curve $E$ of the form:
$$
y^2 = x^3 + 4
$$
defined over a finite field $\mathbb{F}_p$, where the prime $p$ is the following $381$-bit number:
```
p = 4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559787
```

The number of points $\#E(\mathbb{F}_p) = p+1-t$ can be factorized as follows:
```
3 * 11^2 * 10177^2 * 859267^2 * 52437899^2 * 52435875175126190479447740508185965837690552500527637822603658699938581184513
```
where `t = x + 1 = -15132376222941642751` is known as the *trace of Frobenius* and `x` is the *BLS-family parameter* that generates this specific curve.

Therefore, its $255$-bit prime factor:
```
r = 52435875175126190479447740508185965837690552500527637822603658699938581184513
```
is the only one with sufficiently size for cryptographic purposes.

The point $P \in E(\mathbb{F}_p)$ with coordinates:
```
x = 3685416753713387016781088315183077757961620795782546409894578378688607592378376318836054947676345821548104185464507
y = 1339506544944476473020471379941921221584933875938349620426543736416511423956333506472724655353366534992391756441569
```
is a point of order $r$, i.e. a generator of the subgroup of size $r$ of the curve.

The embedding degree $k$ of this curve is $12$.

### Tower of Extension Fields

To represent $\mathbb{F}_{p^{12}}$ we use the following tower of extension fields:
fields:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 - \beta), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - \xi), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v),
\end{aligned}
$$
where $\beta$ is not a quadratic residue in $\mathbb{F}_p$ and $\xi$ is neither a quadratic residue or a cubic residue in $\mathbb{F}_{p^2}$. 

In the particular case of the BLS12-381, we have $\beta = -1$ and $\xi = 1+u$ and therefore:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 + 1), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - (1+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v),
\end{aligned}
$$

from which we can extract the identities $u^2 = -1$, $w^2 = v$, $v^3 = 1+u$ and consequently the idenity $w^6 = 1+u$.

Using the latter identity, we can also write:
$$
\mathbb{F}_{p^{12}} = \mathbb{F}_{p^2}[w]/(w^6 - (1+u))
$$

These two representations of $\mathbb{F}_{p^{12}}$ will allow us to apply some optimizations:
1. Writing any element $f \in \mathbb{F}_{p^{12}}$ as $f = g + h w$, with $g,h \in \mathbb{F}_{p^{6}}$ implies $f^{p^6} = \bar{f} = g - h w$. Thus, computing the $p^6$-th power of any element in $\mathbb{F}_{p^{12}}$ is computationally "free".
2. Now, if we write $g = g_0 + g_1v + g_2v^2$ and $h = h_0 + h_1v + h_2v^2$ where $g_0$,$g_1$,$g_2$,$h_0$,$h_1$,$h_2 \in \mathbb{F}_{p^2}$ we have:
   $$
   f = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5,
   $$
   which will allow us to compute $f^p$ and $f^{p^2}$ (needed for the final exponentiation) very efficiently.

### Twist

BLS curves admits a sextic twist $E'$ defined over $\mathbb{F}_{p^2}$ of the form:
$$
y'^2 = x'^3 + 4·(1+u).
$$

> [!TIP]
> This means that pairing computations can be restricted to points $P \in E(\mathbb{F}_p)$ and $Q \in E'(\mathbb{F}_{p^2})$ and avoid computations over $\mathbb{F}_{p^{12}}$ entirely.

The point $P \in E'(\mathbb{F}_{p^2})$ with coordinates:
```
x = 352701069587466618187139116011060144890029952792775240219908644239793785735715026873347600343865175952761926303160 + 3059144344244213709971259814753781636986470325476647558659373206291635324768958432433509563104347017837885763365758·u
y = 1985150602287291935568054521177171638300868978215655730859378665066344726373823718423869104263333984641494340347905 + 927553665492332455747201965776037880757740193453592970025027978793976877002675564980949289727957565575433344219582·u
```
is a point of order $r$, i.e. a generator of the subgroup of size $r$ of the curve.

The following mapping, known as the **untwist**:
$$
\varphi(x',y') = (x'/w^2,y'/w^3)
$$
with:
```
1/w^2 = (2001204777610833696708894912867952078278441409969503942666029068062015825245418932221343814564507832018947136279894 + 2001204777610833696708894912867952078278441409969503942666029068062015825245418932221343814564507832018947136279893·u)·w^4
1/w^3 = (2001204777610833696708894912867952078278441409969503942666029068062015825245418932221343814564507832018947136279894 + 2001204777610833696708894912867952078278441409969503942666029068062015825245418932221343814564507832018947136279893·u)·w^3
```
defines a group isomorphism from $E'(\mathbb{F}_{p^2})[r]$ to $E(\mathbb{F}_{p^{12}})[r] \cap \text{Ker}(\pi_p - [p])$ and we are going to use it to convert points from the twisted curve $E'$ to the curve $E$ only whenever required.

The inverse mapping, the **twist**, is defined as:
$$
\varphi^{-1}(x',y') = (x'w^2,y'w^3).
$$

## The Pairing

The optimal Ate pairing $e : \mathbb{G}_1 \times \mathbb{G}_2 \to \mathbb{G}_T$ over the BLS12-381 curve is defined by:
$$
e(P,Q) =  \overline{f_{|x|,Q}(P)}^{\frac{p^{12}-1}{r}}
$$
where:
* $\mathbb{G}_1 = E(\mathbb{F}_p)[r]$ is the only subgroup of the $r$-torsion of $E$ over $\mathbb{F}_p$.
* $\mathbb{G}_2 = E(\mathbb{F}_{p^{12}})[r] \cap\text{Ker}(\pi_p - [p])$, represented for point arithmetic efficiency by $E'(\mathbb{F}_{p^2})[r]$. The former is the trace zero subgroup of the $r$-torsion of $E$ over $\mathbb{F}_{p^{12}}$, whereas the latter is the only subgroup of the $r$-torsion of $E'$ over $\mathbb{F}_{p^2}$.
* $\mathbb{G}_T = \mu_r$ is the set of $r$-th roots of unity over $\mathbb{F}^*_{p^{12}}$.
* `x = -15132376222941642752`, which is a number of $64$ bits that can be expressed in binary as:
    ```
  2^63 + 2^62 + 2^60 + 2^57 + 2^48 + 2^16
  [1,1,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  0b1101001000000001000000000000000000000000000000010000000000000000
    ```
    and has a Hamming weight of 6.

* $f_{i,Q}$, for any $i \in \mathbb{N}$ and $Q \in \mathbb{G}_2$, is a $\mathbb{F}_{p^{12}}$ rational function on $E$ that is computed using Miller's "double-and-add"-style algorithm:
  $$
  \begin{aligned}
  f_{i+j,Q} = f_{i,Q} \cdot f_{j,Q} \cdot \frac{\ell_{[i]\varphi(Q),[j]\varphi(Q)}}{v_{[i+j]\varphi(Q)}}, \\
  f_{i+1,Q} = f_{m,Q} \cdot \frac{\ell_{[i]\varphi(Q),\varphi(Q)}}{v_{[i+1]\varphi(Q)}}, \\
  \end{aligned}
  $$
  starting with $f_{1,Q} = 1$.

> [!NOTE]
> The conjugate of an element in $f = a + bw$ in $\mathbb{F}_{p^{12}}$ is $\bar{f} = a -bw$. Hence, if we write $f = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5$ we have:
> $$
> \bar{f} = g_0 - h_0w + g_1w^2 - h_1w^3 + g_2w^4 - h_2w^5.
> $$

Therefore, what we want to compute is the following:
```python
def e(P,Q):
    assert(subgroup_check_G1(P))
    assert(subgroup_check_G2(Q))
    if ((P == 0) or (Q == 0)) return 1 # Here, 0 represents the 
                                       # point at infinity
    R = Q
    f = 1
    for i in range(len(x)-2,-1,-1):
        f = f * f * line(untwist(R),untwist(R),P)
        R = 2 * R
        if x[i] == 1:
            f = f * line(untwist(R),untwist(Q),P)
            R = R + Q

    return final_exponentiation(conjugate(f))
```

In what follows we explain how to compute each of the components of the previous pseudocode snippet.

## Subgroup Checks

To summary [2019/814](https://eprint.iacr.org/2019/814.pdf), we have:
* A point $P \in E(\mathbb{F}_{p})$ belongs to $\mathbb{G}_1 = E(\mathbb{F}_{p})[r]$ if and only if:
  $$
  \left[\frac{x^2-1}{3}\right]([2]\sigma(P) - P - \sigma^2(P)) = \sigma^2(P)
  $$
  where $\sigma : E(\mathbb{F}_{p}) \to E(\mathbb{F}_{p})$ is the [well-known](https://www.iacr.org/archive/crypto2001/21390189.pdf) endomorphism[^endo] defined by $(a,b) \to (\gamma·a, b)$, where $\gamma \in \mathbb{F}_p^*$ is of order $3$.
    ```
    𝛄 = 4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939436
    ```

  This is clearly much cheaper than the naive scalar multiplication by $r$, since its main cost is the scalar multiplication by $(x^2-1)/3$, which is half the size of $r$ and has low Hamming weight.

    <!--
    **Costs:** $2m_p + 1pd_p + 2ps_p + (126pd_p + 43pa_p) + 2eq_p$
    -->

* A point $Q \in E'(\mathbb{F}_{p^2})$ belongs to $\mathbb{G}_2 = E'(\mathbb{F}_{p^2})[r]$ if and only if:
  $$
  [x]\psi^3(Q) + Q = \psi^2(Q)
  $$ 
  where $\psi : E'(\mathbb{F}_{p^2}) \to E'(\mathbb{F}_{p^2})$ is the **untwist-Frobenius-twist endomorphism**, i.e., $\psi := \varphi^{-1} \pi_p \varphi$.

  Again, this is much cheaper than the naive scalar multiplication by $r$, since its main cost is the scalar multiplication by $x$, which is roughly a fourth the size of $r$.

    <!--
    **Costs:** $3·(\underbrace{2m_{p^2}}_{\text{untwist}} + \underbrace{6neg + 5m_{p^2}}_{\text{Frobenius}} +\underbrace{0}_{\text{twist}}) + 1pa_{p^2} + (64pd_{p^2} + 6pa_{p^2}) + 2eq_{p^2}$
    -->

## Line Equations

### Different Points

Given two points $Q_1 =(x_1',y_1')$ and $Q_2=(x_2',y_2')$ in the twisted curve $E'(\mathbb{F}_{p^2})$ such that $x_1' \neq y_1'$ and $x_2' \neq y_2'$ and a point $P=(x,y)$ in the curve $E(\mathbb{F}_p)$, the evaluation at $P$ of the line passing through $\varphi(Q_1)$ and $\varphi(Q_2)$ is given by:
$$
\ell_{\varphi(Q_1),\varphi(Q_2)}(P) = (x_1'y_2'-x_2'y_1') + w^2(y_1'-y_2')x + w^3(x_2'-x_1')y 
$$

<!--
**Costs:** $2m_{p^2} + 3s_{p^2} + 2sc$
-->

### The Same Points

Given a point $Q =(x',y')$ in the twisted curve $E'(\mathbb{F}_{p^2})$ and a point $P=(x,y)$ in the curve $E(\mathbb{F}_p)$, the evaluation at $P$ of the line passing through $\varphi(Q)$ is given by:
$$
\ell_{\varphi(Q),\varphi(Q)}(P) = w(3x'^3-2y'^2) + w^3(-3xx'^2) + w^4(2yy')
$$

<!--
**Costs:** $3m_{p^2} + 1s_{p^2} + 6sc$
-->

## Final Exponentiation

In the final exponentiation, we raise an element $f \in \mathbb{F}_{p^{12}}$ to the power $(p^{12}-1)/r$.

First, divide the exponent as follows:
$$
\frac{p^{12}-1}{r} = \underbrace{(p^6-1)(p^2+1)}_{\text{easy part}}\underbrace{\frac{p^4-p^2+1}{r}}_{\text{hard part}}
$$

### The Easy Part

Let's start with the easy part of the easy part, when we first attempt to compute $f^{p^6 - 1}$. But since, $f^{p^6} = \bar{f}$, we have $f^{p^6 - 1} = \bar{f} \cdot f^{-1}$, just one conjugate, one inversion and one multiplication in $\mathbb{F}_{p^{12}}$.

To finish the easy part, we first compute $(f^{(p^6 - 1)})^{p^2}$ which is the Frobenius operator applied to $f^{p^6-1}$ and then multiply the result by $f^{p^6 - 1}$ to finally obtain $m := f^{(p^6-1)(p^2+1)} \in \mathbb{F}_{p^{12}}$.

Importantly, after the computation of the easy part, the resulting field element becomes a member of the cyclotomic subgroup $\mathbb{G}_{\phi_{6}(p^2)} = \mathbb{G}_{\phi_{12}(p)} = \{a \in \mathbb{F}_{p^{12}} \mid a^{\phi_{12}(p)} = a^{p^4-p^2+1} = a^{p^6+1} = 1\}$, which means that **inversion from now on can be computed by simply conjugation**. Moreover, when an element $a$ belongs to $\mathbb{G}_{\phi_{6}(p^2)}$, one can compute $a^2$ using fewer multiplications and therefore the overall costs of performing exponentiations (see [this section](#speeding-up-exponentiations-in-the-cyclotomic-subgroup)).

### The Hard Part

Following Section 5 of this [2020/875](https://eprint.iacr.org/2020/875.pdf), we can write:
$$
\frac{p^4-p^2+1}{r} = \frac{(|x|+1)^2\cdot(p-|x|)\cdot(x^2+p^2-1)}{3}+1.
$$

To compute it, we proceed as follows:
```python
def hard_part(m):
    x = abs(x)
    
    # 1] m^{(x+1)/3}
    y1 = m**((x+1)/3)
    
    # 2] m^{(x+1)^2/3}
    y2 = y1**(x+1)
    
    # 3.1] m^{(x+1)^2/3*-x}
    y31 = conjugate(y2)**x
    
    # 3.2] m^{(x+1)^2/3*p}
    y32 = Frobenius1(y2)
    
    # 4] m^{(x+1)^2/3*(p-x)}
    y4 = y31*y32
    
    # 5.1] m^{(x+1)^2/3*(p-x)*x^2}
    y51 = (y4**x)**x
    
    # 5.2] m^{(x+1)^2/3*(p-x)*p^2}
    y52 = Frobenius2(y4)
    
    # 5.3] m^{(x+1)^2/3*(p-x)*-1}
    y53 = conjugate(y4)
    
    # 6] m^{(x+1)^2/3*(p-x)*(x^2+p^2)}
    y6 = y51*y52
    
    # 7] m^{(x+1)^2/3*(p-x)*(x^2+p^2-1)}
    y7 = y6*y53
    
    # 8] m^{(x+1)^2/3*(p-x)*(x^2+p^2-1)+1}
    y8 = y7*m

    return y8
```

(recall that, at this point, computing the conjugate is the same as computing the inverse)

## Frobenius Operator

As we have shown, in the final exponentation we must compute the first and second Frobenius operator $\pi_p,\pi_p^2$ over an element in $\mathbb{F}_{p^{12}}$. Recalling that $\pi_p^i(x) = x^{p^i}$, a naive implementation would take $O(\log p)$ $\mathbb{F}_{p^{12}}$-operations, but we will do it much better.

Recall that we can write any element $f \in \mathbb{F}_{p^{12}}$ as:
$$
f = g + h w = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5
$$
where $g = g_0 + g_1v + g_2v^2$ and $h = h_0 + h_1v + h_2v^2$ with $g,h \in \mathbb{F}_{p^{6}}$ and $g_i,h_i \in \mathbb{F}_{p^2}$.

Then, we have:
$$
\begin{aligned}
f^{p} = \bar{g}_0 + \bar{h}_0\gamma_{1,1}w + \bar{g}_1\gamma_{1,2}w^2 + \bar{h}_1\gamma_{1,3}w^3 + \bar{g}_2\gamma_{1,4}w^4 + \bar{h}_2\gamma_{1,5}w^5, \\
f^{p^2} = g_0 + h_0\gamma_{2,1}w + g_1\gamma_{2,2}w^2 + h_1\gamma_{2,3}w^3 + g_2\gamma_{2,4}w^4 + h_2\gamma_{2,5}w^5,
\end{aligned}
$$
with $\gamma_{1,i} = (1+u)^{i\frac{p-1}{6}}$ and $\gamma_{2,i} = (1+u)^{i\frac{p^2-1}{6}} = \gamma_{1,i} \cdot \bar{\gamma}_{1,i}$. 

<details><summary>Expand to see the proof</summary>

We will now show that raising an $\mathbb{F}_{p^2}$-element over any power of $p$ is almost cost free and therefore so is raising $f$.
- Take $b = b_0 + b_1u \in \mathbb{F}_{p^2}$ with $b_0,b_1 \in \mathbb{F}_{p}$. Then, $b^{p^{2i}} = b_0 + b_1(u^{(p^{2})^i}) = b_0 + b_1u = b$ from Lagrange theorem. Similarly, $b^{p^{2i-1}} =  \frac{b^{p^{2i}}}{b^{p^2} \cdot b^p} = \frac{b}{b \cdot b^{-p}} = \frac{1}{b^{-p}} = b^p = \bar{b}$.
- Notice $w^p = (w^6)^{\frac{p-1}{6}}w = (1+u)^{\frac{p-1}{6}}w$ and therefore $(w^{i})^p = \gamma_{1,i}w^i$, where $\gamma_{1,i} = (1+u)^{i\frac{p-1}{6}}$.

Using all the previous observations, we have:
$$
\begin{aligned}
f^p &= (g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5)^p \\
    &= \bar{g}_0 + \bar{h}_0w^p + \bar{g}_1w^{2p} + \bar{h}_1w^{3p} + \bar{g}_2w^{4p} + \bar{h}_2w^{5} \\
    &= \bar{g}_0 + \bar{h}_0\gamma_{1,1}w + \bar{g}_1\gamma_{1,2}w^2 + \bar{h}_1\gamma_{1,3}w^3 + \bar{g}_2\gamma_{1,4}w^4 + \bar{h}_2\gamma_{1,5}w^5,
\end{aligned}
$$
which can be computed using a few multiplications and a few conjugations, assuming each $\gamma_{1,i}$ is pre-computed for $i \in [5]$.

Similarly, notice $w^{p^2} = (1+u)^{\frac{p^2-1}{6}}w = (\gamma_{1,1})^{1+p}w = \gamma_{1,1} \cdot \bar{\gamma}_{1,1}w$ and therefore $(w^{i})^{p^2} = \gamma_{2,i}w^i$, where $\gamma_{2,i} = \gamma_{1,i} \cdot \bar{\gamma}_{1,i}$. 

</details>

Hence, assuming the precomputation of $\gamma_{1,i},\gamma_{2,i}$ for $i \in [5]$, we can compute $f^p$ and $f^{p^2}$ almost for free.

## Speeding up Exponentiations in the Cyclotomic Subgroup

I follow [2010/542](https://eprint.iacr.org/2010/542.pdf) closely for this section.

Recall that:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 + 1), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - (1+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v).
\end{aligned}
$$
and also:
$$
\mathbb{F}_{p^{12}} = \mathbb{F}_{p^2}[w]/(w^6 - (1+u))
$$

For this optimitzation, it will be useful to introduce $\mathbb{F}_{p^{4}}$ and represent $\mathbb{F}_{p^{12}}$ as a degree-3 extension of $\mathbb{F}_{p^{4}}$:
$$
\begin{aligned}
\mathbb{F}_{p^{4}} &= \mathbb{F}_{p^2}[V]/(V^2 - (1+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^4}[w]/(w^3 - V),
\end{aligned}
$$
where $V = w^3$; so that an element $f$ in $\mathbb{F}_{p^{12}}$ can be written as $f = (g_0 + g_1 V) + (g_2 + g_3 V) w + (g_4 + g_5 V) w^2$. We can equivalently write $f = g_0 + g_2 w + g_4 w^2 + g_1 w^3 + g_3 w^4 + g_5 w^5$.

These optimizations are due to "compression" and "decompression" techniques, which exploits the algebraic relationships arising from elements belonging to the cyclotomic subgroup $\mathbb{G}_{\phi_{6}(p^2)}$.

### Compression and Decompression

If $f = g_0 + g_2w + g_4w^2 + g_1w^3 + g_3w^4 + g_5w^5 \in \mathbb{G}_{\phi_{6}(p^2)}$ then the compression function $\mathcal{C}$ is:
$$
\mathcal{C}(f) = [g_2,g_3,g_4,g_5].
$$
and the decompression function $\mathcal{D}$ is:
$$
\mathcal{D}([\tilde{g}_2,\tilde{g}_3,\tilde{g}_4,\tilde{g}_5]) = \tilde{g}_0 + \tilde{g}_2w + \tilde{g}_4w^2 + \tilde{g}_1w^3 + \tilde{g}_3w^4 + \tilde{g}_5w^5,
$$
where:
$$
\begin{cases}
\tilde{g}_1 = \frac{\tilde{g}_5^2(1+u) + 3\tilde{g}_4^2 - 2\tilde{g}_3}{4\tilde{g}_2}, \quad \tilde{g}_0 = (2\tilde{g}_1^2 + \tilde{g}_2\tilde{g}_5 - 3\tilde{g}_3\tilde{g}_4)(1+u) + 1, & \text{if } \tilde{g}_2 \neq 0 \\
\tilde{g}_1 = \frac{2\tilde{g}_4\tilde{g}_5}{\tilde{g}_3}, \qquad\qquad\quad \tilde{g}_0 = (2\tilde{g}_1^2 - 3\tilde{g}_3\tilde{g}_4)(1+u) + 1, & \text{if } \tilde{g}_2 = 0
\end{cases}
$$

### Compressed Squaring

Now, on input $f \in \mathbb{G}_{\phi_{6}(p^2)}$ we will be able to compute its square on compressed form. That is, $\mathcal{C}(f^2) = [h_2, h_3, h_4, h_5]$, where $h = f^2 = h_0 + h_2w + h_4w^2 + h_1w^3 + h_3w^4 + h_5w^5$:
$$
\begin{aligned}
h_2 &= 2(g_2 + 3(1+u)B_{4,5}), \\
h_3 &= 3(A_{4,5} - (2 + u)B_{4,5}) - 2g_3, \\
h_4 &= 3(A_{2,3} - (2+u)B_{2,3}) - 2g_4, \\
h_5 &= 2(g_5 + 3B_{2,3}), \\
A_{i,j} &= (g_i + g_j)(g_i + (1+u)g_j), \\
B_{i,j} &= g_i \cdot g_j.
\end{aligned}
$$

### Exponentiation in the Cyclotomic Subgroup

Given $f \in \mathbb{G}_{\phi_{6}(p^2)} \subset \mathbb{F}_{p^{12}}^*$ and $e \geq 1$, the idea is to compute $f^e$ using the squaring formula in compressed form.

Represent $e$ in binary as $e = e_{\ell-1}e_{\ell-2}\dots e_1e_0$ with $e_{\ell-1}=1$ and define $H_e = \{i : 1 \leq i \leq \ell - 1 \text{ and } e_i = 1\}$. Then:
$$
f^e = \prod_{i=0}^{\ell - 1} f^{e_i \cdot 2^i} = \prod_{i = 0}^{\ell - 1} (f^{2^i})^{e_i} = f^{e_0} \prod_{i \in H_e} \mathcal{D}(\mathcal{C}(f)^{2^i}).
$$

Therefore, we can use the square-and-multiply algorithm to compute such product. Since we are going to be squaring in compressed form, we start at $\mathcal{C}(f)$ rather than the standard $f$ in such algorithm.

```python
def exp_cyclo(f,e):
    Cf = comp(f);
    result = 1;
    for i in range(len(e)):
        if (e[i] == 1) {
            result = decomp(Cf) * result;
        }

        Cf = square_comp(Cf);
    }

    return result;
```

## Resources

- [BLS12-381 For The Rest Of Us](https://hackmd.io/@benjaminion/bls12-381)
- [Constructing Elliptic Curves with Prescribed Embedding Degrees](https://eprint.iacr.org/2002/088.pdf)
- [BLS12-381: New zk-SNARK Elliptic Curve Construction](https://electriccoin.co/blog/new-snark-curve/)
- [Draft IETF standard for pairing-friendly curves](https://www.ietf.org/archive/id/draft-irtf-cfrg-pairing-friendly-curves-11.html)
- [Zcash code](https://github.com/zcash/librustzcash/tree/6e0364cd42a2b3d2b958a54771ef51a8db79dd29/pairing/src/bls12_381)
- [Faster Subgroup Checks for BLS12-381](https://eprint.iacr.org/2019/814.pdf)
- [Faster Point Multiplication on Elliptic Curves with Efficient Endomorphisms](https://www.iacr.org/archive/crypto2001/21390189.pdf)
- [Efficient Final Exponentiation via Cyclotomic Structure for Pairings over Families of Elliptic Curves](https://eprint.iacr.org/2020/875.pdf)
- [Squaring in Cyclotomic Subgroups](https://eprint.iacr.org/2010/542.pdf)

[^endo]: The endomorphism $\sigma$ acts as a multiplication map $[\lambda]P$, where $\lambda = t^2 - 1$.
