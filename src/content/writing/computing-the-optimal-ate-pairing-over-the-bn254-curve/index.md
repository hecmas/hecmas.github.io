---
title: "Computing the Optimal Ate Pairing over the BN254 Curve"
summary: "The optimal Ate pairing on BN254, step by step: twist, line equations, the Miller loop's last two lines, final exponentiation and Frobenius shortcuts, as implemented in the Polygon zkEVM."
date: 2023-04-05
tags: ["Pairings", "Elliptic Curves", "Polygon zkEVM"]
draft: false
hackmd: "https://hackmd.io/kcEJAWISQ56eE6YpBnurgw"
---

The post [BN254 For The Rest Of Us](https://hackmd.io/@jpw/bn254) constitutes the base point for this article, so I highly recommend reading it to get a solid background of the BN254 curve. This post will reuse some parts with an emphasy on the computational aspect of the optimal Ate pairing over the BN254 curve. 

For those with a poor background on Pairing-Based Cryptography (PBC) but with a decent background on Elliptic-Curve Cryptoraphy (ECC) I recommend reading the following resources in order:
1. [Pairings For Beginners](https://static1.squarespace.com/static/5fdbb09f31d71c1227082339/t/5ff394720493bd28278889c6/1609798774687/PairingsForBeginners.pdf).
2. [Pairing-Friendly Elliptic Curves of Prime Order](https://www.cryptojedi.org/papers/pfcpo.pdf).
3. [High-Speed Software Implementation of the Optimal Ate Pairing over Barreto–Naehrig Curves](https://eprint.iacr.org/2010/354.pdf).

Only after (and not before) you feel sufficiently comfortable with both PBC and ECC come back to this post and start to make sense out of it. 

The implementation in zkASM can be found [here](https://github.com/0xPolygonHermez/zkevm-rom/tree/main/main/pairings).

## The Curve

The BN254 is the elliptic curve $E$ of the form:
$$
y^2 = x^3 + 3
$$
defined over a finite field $\mathbb{F}_p$, where the prime $p$ is the following $254$-bit number:
```
p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
```

The number of points $\#E(\mathbb{F}_p) = p+1-t$ happens to also be a prime $r$ of $254$ bits:
```
r = 21888242871839275222246405745257275088548364400416034343698204186575808495617
```
where `t = 147946756881789318990833708069417712967` is known as the *trace of Frobenius*.

The point $(1,2) \in E(\mathbb{F}_p)$ is a point of order $r$, i.e. a generator of the group of points of the curve. In fact, all points in $E(\mathbb{F}_p)\backslash\{\mathcal{O}\}$ are generators, as [Lagrange's Theorem](https://en.wikipedia.org/wiki/Lagrange%27s_theorem_(group_theory)) shows.

The embedding degree $k$ of this curve is $12$.

For more information, refer to [BN254 For The Rest Of Us](https://hackmd.io/@jpw/bn254) or the EIPs [196](https://eips.ethereum.org/EIPS/eip-196) and [197](https://eips.ethereum.org/EIPS/eip-197).

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

In the particular case of the BN254, we have $\beta = -1$ and $\xi = 9+u$ and therefore:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 + 1), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - (9+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v),
\end{aligned}
$$

from which we can extract the identities $u^2 = -1$, $w^2 = v$, $v^3 = 9+u$ and consequently the idenity $w^6 = 9+u$.

Using the latter identity, we can also write:
$$
\mathbb{F}_{p^{12}} = \mathbb{F}_{p^2}[w]/(w^6 - (9+u))
$$

These two representations of $\mathbb{F}_{p^{12}}$ will allow us to apply some optimizations:
1. Writing any element $f \in \mathbb{F}_{p^{12}}$ as $f = g + h w$, with $g,h \in \mathbb{F}_{p^{6}}$ implies [^conjugate] $f^{p^6} = \bar{f} = g - h w$. Thus, computing the $p^6$-th power of any element in $\mathbb{F}_{p^{12}}$ is computationally "free".
1. Now, if we write $g = g_0 + g_1v + g_2v^2$ and $h = h_0 + h_1v + h_2v^2$ where $g_0$,$g_1$,$g_2$,$h_0$,$h_1$,$h_2 \in \mathbb{F}_{p^2}$ we have:
   $$
   f = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5,
   $$
   which will allow us to compute $f^p,f^{p^2}$ and $f^{p^3}$ (needed for the final exponentiation) very efficiently.

### Twist

BN curves admits a sextic twist $E'$ defined over $\mathbb{F}_{p^2}$ of the form:
$$
y'^2 = x'^3 + 3/(9+u)
$$
or more specifically:
```
(y')² = (x')³ + (19485874751759354771024239261021720505790618469301721065564631296452457478373 + 266929791119991161246907387137283842545076965332900288569378510910307636690·u)
```

> [!TIP]
> This means that pairing computations can be restricted to points $P \in E(\mathbb{F}_p)$ and $Q \in E'(\mathbb{F}_{p^2})$ and avoid computations over $\mathbb{F}_{p^{12}}$ entirely.

The number of points of $E'$ is:
$$
\#E'(\mathbb{F}_{p^2}) = (p+1-t)(p-1+t) = r \cdot c
$$
which concrete to:
```
#E' = 479095176016622842441988045216678740799252316531100822436447802254070093686356349204969212544220033486413271283566945264650845755880805213916963058350733
c = 21888242871839275222246405745257275088844257914179612981679871602714643921549
```

The mapping
$$
\Psi(x',y') = (w^2x',w^3y')
$$
defines a group homomorphism from $E'(\mathbb{F}_{p^2})$ to $E(\mathbb{F}_{p^{12}})$ and we are going to use it to send points from the twisted curve $E'$ to the curve $E$ (but not the other way around).

## The Pairing

The optimal Ate pairing $e : \mathbb{G}_1 \times \mathbb{G}_2 \to \mathbb{G}_T$ over the BN254 curve is defined by:
$$
e(P,Q) = \left( f_{6x+2,Q}(P) \cdot \ell_{[6x+2]\Psi(Q),\pi_p(\Psi(Q))}(P) \cdot \ell_{[6x+2]\Psi(Q)+\pi_p(\Psi(Q)),-\pi_p^2(\Psi(Q))}(P) \right)^{\frac{p^{12}-1}{r}}
$$
where:
* $\mathbb{G}_1 = E(\mathbb{F}_p)[r]$ is the only subgroup of the $r$-torsion of $E$ over $\mathbb{F}_p$.
* $\mathbb{G}_2 = E'(\mathbb{F}_{p^2})[r]$ is the only subgroup of the $r$-torsion of $E'$ over $\mathbb{F}_{p^2}$.
* $\mathbb{G}_T = \mu_r$ is the set of $r$-th roots of unity over $\mathbb{F}^*_{p^{12}}$.
* `x = 4965661367192848881` and therefore `6x+2 = 29793968203157093288`, which is a number of $65$ bits that can be expressed in the base $\{-1,0,1\}$ as follows:
    ```
    2^3 + 2^5 - 2^7 + 2^10 - 2^11 + 2^14 + 2^17 + 2^18 - 2^20 + 2^23 - 2^25 + 2^30 + 2^31 + 2^32 - 2^35 + 2^38 - 2^44 + 2^47 + 2^48 - 2^51 + 2^55 + 2^56 - 2^58 + 2^61 + 2^63 + 2^64
    [0, 0, 0, 1, 0, 1, 0, -1, 0, 0, 1, -1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 0, 0, 1, 0, -1, 0, 0, 0, 0, 1, 1, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 1, 0, 0, -1, 0, 0, 0, 1, 1, 0, -1, 0, 0, 1, 0, 1, 1]
    0001010-1001-100100110-10010-1000011100-100100000-1001100-1000110-1001011
    ```
    which has a Hamming weight of 26.

    We prefer base $\{-1,0,1\}$ over base $\{0,1\}$ because `6x+2` expressed in the latter is:
    ```
    2^3 + 2^5 + 2^7 + 2^8 + 2^9 + 2^11 + 2^12 + 2^13 + 2^17 + 2^18 + 2^20 + 2^21 + 2^22 + 2^25 + 2^26 + 2^27 + 2^28 + 2^29 + 2^31 + 2^32 + 2^35 + 2^36 + 2^37 + 2^44 + 2^45 + 2^46 + 2^48 + 2^51 + 2^52 + 2^53 + 2^54 + 2^56 + 2^58 + 2^59 + 2^60 + 2^63 + 2^64 
    [0,0,0,1,0,1,0,1,1,1,0,1,1,1,0,0,0,1,1,0,1,1,1,0,0,1,1,1,1,1,0,1,1,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,1,1,0,0,1,1]
    00010101110111000110111001111101100111000000111010011110101110011
    ```
    which has a Hamming weigth of 37.
    
> [!NOTE]
>     I moved from base $\{0,1\}$ to base $\{-1,0,1\}$ by using the identity[^NAF] $$2^{n+1} - 2^m = 2^n + 2^{n-1} + ... + 2^m,$$ that holds for any $n,m \in \mathbb{N}$ such that $n \geq m$. In words, it is unpacking groups of $1$'s of any size to a single $1$ and $-1$ in the binary decomposition.

* $f_{i,Q}$, for any $i \in \mathbb{N}$ and $Q \in \mathbb{G}_2$, is a $\mathbb{F}_{p^{12}}$ rational function on $E$ that is computed using Miller's "double-and-add"-style algorithm:
  $$
  \begin{aligned}
  f_{i+j,Q} = f_{i,Q} \cdot f_{j,Q} \cdot \frac{\ell_{[i]\Psi(Q),[j]\Psi(Q)}}{v_{[i+j]\Psi(Q)}}, \\
  f_{i+1,Q} = f_{m,Q} \cdot \frac{\ell_{[i]\Psi(Q),\Psi(Q)}}{v_{[i+1]\Psi(Q)}}, \\
  \end{aligned}
  $$
  starting with $f_{1,Q} = 1$.
* $\ell_{P_1,P_2}$ denotes the equation of a line passing through $P_1$ and $P_2$ while $v_{P}$ denotes the equation of a vertical line passing through $P$. However, due to the final exponentiation, the **value of $e(P,Q)$ remains unchanged if we omit the division by the vertical lines**, so we will not care about such computation.
* $\pi_p^i(x,y) = (x^{p^i},y^{p^i})$ is known as the *Frobenius operator*.

Therefore, what we want to compute is the following:
```python
bound = [0, 0, 0, 1, 0, 1, 0, -1, 0, 0, 1, -1, 0, 0, 1, 0, 0, 1, 1, 0, -1,
         0, 0, 1, 0, -1, 0, 0, 0, 0, 1, 1, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0,
         0, 0, -1, 0, 0, 1, 1, 0, 0, -1, 0, 0, 0, 1, 1, 0, -1, 0, 0, 1, 0,
         1, 1] 

1101111010011011000001001001000111011101011100001011001111110111111100000111110100101101000001011101000011111001111110101000110

         # This is 6x+2 in base {-1,0,1}, which has a Hamming weight of 26

def e(P,Q):
    assert(subgroup_check_G1(P))
    assert(subgroup_check_G2(Q))
    if ((P == 0) or (Q == 0)) return 1 # Here, 0 is the identity element of E
    
    R = Q
    f = 1
    for i in range(len(bound)-2,-1,-1): # len(bound)=65
        f = f * f * line(twist(R),twist(R),P)
        R = 2 * R
        if bound[i] == 1:
            f = f * line(twist(R),twist(Q),P)
            R = R + Q
        elif bound[i] == -1:
            f = f * line(twist(R),twist(-Q),P)
            R = R - Q
            
    Qp = FrobEndo(Q); # Q'
    f = f * line(twist(R), twist(Qp), P);
    R = R + Qp;
    Qpp = -FrobEndo(Qp); # Q''
    f = f * line(twist(R), twist(Qpp), P);

    return final_exponentiation(f)
```

In what follows we explain how to compute each of the components of the previous pseudocode snippet.

## Subgroup Checks

To summary [BN254 For The Rest Of Us](https://hackmd.io/@jpw/bn254), we have:
* $P \in \mathbb{G}_1 = E(\mathbb{F}_p)[r]$ if and only if $P \in E(\mathbb{F}_p)$. That is, if we write $P = (x,y)$ then we simply need to ensure that the equation $y^2 = x^3 + 3$ holds over $\mathbb{F}_p$.

    **Costs:** $2s + 1m + 1a$
* A point $Q = (x',y') \in E'(\mathbb{F}_{p^2})$ belongs to $\mathbb{G}_2 = E'(\mathbb{F}_{p^2})[r]$ if and only if:
  $$
  [x+1]Q + \psi([x]Q) + \psi^2([x]Q) = \psi^3([2x]Q)
  $$
  where $\psi : E'(\mathbb{F}_{p^2}) \to E'(\mathbb{F}_{p^2})$ is defined as $\psi(x',y') = ({\gamma_{1,2}}\bar{x}',\gamma_{1,3}\bar{y}')$,
  where $\gamma_{1,2} = (9+u)^{\frac{p-1}{3}},\gamma_{1,3} = (9+u)^{\frac{p-1}{2}}$.

    This was proven in [2022/348](https://eprint.iacr.org/2022/348.pdf) and it is clearly much faster than the naive check $[r]Q = \mathcal{O}$, since $x \ll r$.

**Costs:** $2\tilde{c} + 2\tilde{m} + \text{cost of } [6x^2]P$

## Line Equations

### Different Points

Given two points $Q_1 =(x_1',y_1')$ and $Q_2=(x_2',y_2')$ in the twisted curve $E'(\mathbb{F}_{p^2})$ such that $x_1' \neq y_1'$ and $x_2' \neq y_2'$ and a point $P=(x,y)$ in the curve $E(\mathbb{F}_p)$, the evaluation at $P$ of the line passing through $\Psi(Q_1)$ and $\Psi(Q_2)$ is given by:
$$
\ell_{\Psi(Q_1),\Psi(Q_2)}(P) = w^2(x_2'-x_1')y + w^3(y_1'-y_2')x + w^5(x_1'y_2'-x_2'y_1')
$$

**Costs:** $3\tilde{a} + 2\tilde{m} + 4m$

### The Same Points

Given a point $Q =(x',y')$ in the twisted curve $E'(\mathbb{F}_{p^2})$ and a point $P=(x,y)$ in the curve $E(\mathbb{F}_p)$, the evaluation at $P$ of the line passing through $\Psi(Q)$ is given by:
$$
\ell_{\Psi(Q),\Psi(Q)}(P) = (3x'^3-2y'^2)(9+u) + w^3(2yy') + w^4(-3xx'^2)
$$

**Costs:** $1\tilde{a} + 2\tilde{s} + 2\tilde{m} + 10m$

## The Last two Lines

Now we explain some tricks for the computation of the lines:
$$
\ell_{[6x+2]\Psi(Q),\pi_p(\Psi(Q))}(P), \quad 
\ell_{[6x+2]\Psi(Q)+\pi_p(\Psi(Q)),-\pi_p^2(\Psi(Q))}(P). 
$$

* For the first line notice that if $Q = (x',y') \in E'(\mathbb{F}_{p^2})$, then:
    $$
    \pi_p(\Psi(Q)) = ((w^2x')^p,(w^3y')^p) = (w^2(\gamma_{1,2}x'^p),w^3(\gamma_{1,3}y'^p)) = \Psi(\gamma_{1,2}x'^p,\gamma_{1,3}y'^p) = \Psi({\gamma_{1,2}}\bar{x}',\gamma_{1,3}\bar{y}'),
    $$
    where $\gamma_{1,2} = (9+u)^{\frac{p-1}{3}},\gamma_{1,3} = (9+u)^{\frac{p-1}{2}}$ are precomputed.
> [!NOTE]
>     The conjugate of an element in $f = a + bu$ in $\mathbb{F}_{p^2}$ is $\bar{f} = a -bu$.

    Moreover, due to $\Psi$ being an homomorphism we have that $[n]\Psi(Q) = \Psi([n]Q)$ for all $n \in \mathbb{F}_r$. Consequently, we compute $\ell_{\Psi([6x+2]Q),\Psi(Q')}(P)$ as in the previous section, with $Q' = ({\gamma_{1,2}}\bar{x}',\gamma_{1,3}\bar{y}') = (x_1,y_1)$ (it's a good exercise to check that $Q'$ belongs to $E$).
    
    **Costs:** $\underbrace{2\tilde{c} + 2\tilde{m}}_{Q'} + \ell_{\text{diff}}$
> [!NOTE]
>     I don't include the cost of computing $[6x+2]Q$, since it is obtained in the Miller loop.

* For the second line we similarly have:
    $$
    -\pi_p^2(\Psi(Q)) = -\pi_p(\pi_p(\Psi(Q))) = -\pi_p(\Psi(x_1,y_1)) = \Psi(\gamma_{1,2}\bar{x_1},-\gamma_{1,3}\bar{y_1})
    $$
  Again, due to the homomorphic property of $\Psi$, we compute $\ell_{\Psi([6x+2]Q + Q'),\Psi(Q'')}(P)$ as in the previous section, with $Q'' = (\gamma_{1,2}\bar{x_1},-\gamma_{1,3}\bar{y_1})$ (again, check that $Q''$ belongs to $E$).

    **Costs:** $1E'_{\text{add}} + \underbrace{2\tilde{c} + 2\tilde{m} + 2m}_{Q''} + \ell_{\text{diff}}$

Hence, in both cases, the Frobenius operator comes for free.

## Final Exponentiation

In the final exponentiation, we raise an element $f \in \mathbb{F}_{p^{12}}$ to the power $(p^{12}-1)/r$.

First, divide the exponent as follows:
$$
\frac{p^{12}-1}{r} = \underbrace{(p^6-1)(p^2+1)}_{\text{easy part}}\underbrace{\frac{p^4-p^2+1}{r}}_{\text{hard part}}
$$

### The Easy Part

Let's start with the easy part of the easy part, when we first attempt to compute $f^{p^6 - 1}$. But since, $f^{p^6} = \bar{f}$, we have $f^{p^6 - 1} = \bar{f} \cdot f^{-1}$, just one conjugate, one inversion and one multiplication in $\mathbb{F}_{p^{12}}$.

> [!NOTE]
> The conjugate of an element in $f = a + bw$ in $\mathbb{F}_{p^{12}}$ is $\bar{f} = a -bw$. Hence, if we write $f = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5$ we have:
> $$
> \bar{f} = g_0 - h_0w + g_1w^2 - h_1w^3 + g_2w^4 - h_2w^5.
> $$

To finish the easy part, we first compute $(f^{(p^6 - 1)})^{p^2}$ which is the Frobenius operator applied to $f^{p^6-1}$ and then multiply the result by $f^{p^6 - 1}$ to finally obtain $m := f^{(p^6-1)(p^2+1)} \in \mathbb{F}_{p^{12}}$.

Importantly, after the computation of the easy part, the resulting field element becomes a member of the cyclotomic subgroup $\mathbb{G}_{\phi_{6}(p^2)} = \mathbb{G}_{\phi_{12}(p)} = \{a \in \mathbb{F}_{p^{12}} \mid a^{\phi_{12}(p)} = a^{p^4-p^2+1} = a^{p^6+1} = 1\}$, which means that **inversion from now on can be computed by simply conjugation**. Moreover, when an element $a$ belongs to $\mathbb{G}_{\phi_{6}(p^2)}$, one can compute $a^2$ using fewer multiplications and therefore the overall costs of performing exponentiations (see [this section](#speeding-up-computations-in-the-cyclotomic-subgroup)).

**Costs:** $\underbrace{1C + 1I + 1M}_{f^{p^6-1}} + 5\tilde{m} + 1M$

### The Hard Part

Following Section 5 of this [2008/490](https://eprint.iacr.org/2008/490.pdf), we can write:
$$
\frac{p^4-p^2+1}{r} = \lambda_0 + \lambda_1p + \lambda_2p^2 + \lambda_3p^3,
$$
where:
* $\lambda_0 = -2 - 18x - 30x^2 - 36x^3$.
* $\lambda_1 = 1 - 12x - 18x^2 - 36x^3$.
* $\lambda_2 = 1 + 6x^2$.
* $\lambda_3 = 1$.

So we just need to compute:
$$
m^{\lambda_0}, m^{\lambda_1p}, m^{\lambda_2p^2}, m^{\lambda_3p^3},
$$
and then multiply them all.

> [!NOTE]
> In what follows, remember that `x = 4965661367192848881`, which is a number of $63$ bits that can be expressed in the base $\{-1,0,1\}$ as follows:
> ```
> 1 - 2^4 + 2^9 + 2^11 + 2^16 + 2^19 + 2^21 + 2^22 + 2^25 + 2^27 + 2^30 + 2^34 + 2^36 + 2^37 + 2^39 + 2^41 + 2^44 + 2^47 + 2^48 + 2^51 - 2^53 + 2^56 + 2^58 + 2^62
> [1,0,0,0,-1,0,0,0,0,1,0,1,0,0,0,0,1,0,0,1,0,1,1,0,0,1,0,1,0,0,1,0,0,0,1,0,1,1,0,1,0,1,0,0,1,0,0,1,1,0,0,1,0,-1,0,0,1,0,1,0,0,0,1]
> 1000-1000010100001001011001010010001011010100100110010-1001010001
> ```
> which has a Hamming weight of 24.
> 
> We prefer base $\{-1,0,1\}$ over base $\{0,1\}$ because `x` expressed in the latter is:
> ```
> 1 + 2^4 + 2^5 + 2^6 + 2^7 + 2^8 + 2^11 + 2^16 + 2^19 + 2^21 + 2^22 + 2^25 + 2^27 + 2^30 + 2^34 + 2^36 + 2^37 + 2^39 + 2^41 + 2^44 + 2^47 + 2^48 + 2^51 + 2^53 + 2^54 + 2^55 + 2^58 + 2^62
> [1,0,0,0,1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,1,0,1,1,0,0,1,0,1,0,0,1,0,0,0,1,0,1,1,0,1,0,1,0,0,1,0,0,1,1,0,0,1,0,1,1,1,0,0,1,0,0,0,1]
> 100011111001000010010110010100100010110101001001100101110010001
> ```
> which has a Hamming weigth of 28.

We proceed as follows:
1. We start by computing $m^x, (m^x)^x, (m^{x^2})^x$.
3. Then, compute $m^p, m^{p^2}, m^{p^3}, (m^{x})^p, (m^{x^2})^p, (m^{x^3})^p, (m^{x^2})^{p^2}$ (use the Frobenius operator).
4. Next, we group the previous elements as follows:
   $$
   \begin{aligned}
   y_0 &= m^p \cdot m^{p^2} \cdot m^{p^3}, \\
   y_1 &= \bar{m}, \\
   y_2 &= m^{x^2p^2}, \\
   y_3 &= \overline{m^{xp}}, \\
   y_4 &= \overline{m^{x} \cdot m^{x^2p}}, \\
   y_5 &= \overline{m^{x^2}}, \\
   y_6 &= \overline{m^{x^3} \cdot m^{x^3p}}.
   \end{aligned}
   $$
   (recall that at this point computing the conjugate is the same as computing the inverse)

3. Finally, compute the product:
   $$
   y_0 \cdot y_1^2 \cdot y_2^6 \cdot y_3^{12} \cdot y_4^{18} \cdot y_5^{30} \cdot y_6^{36}
   $$
<details><summary>Expand for correctness</summary>

    $$
    \begin{aligned}
    &y_0 \cdot y_1^2 \cdot y_2^6 \cdot y_3^{12} \cdot y_4^{18} \cdot y_5^{30} \cdot y_6^{36} = \\ 
    &(m^p \cdot m^{p^2} \cdot m^{p^3}) \cdot \left(\frac{1}{m}\right)^2 \cdot (m^{x^2p^2})^6 \cdot \left(\frac{1}{m^{xp}}\right)^{12} \cdot \left(\frac{1}{m^{x}m^{x^2p}}\right)^{18} \cdot \left(\frac{1}{m^{x^2}}\right)^{30} \cdot \left(\frac{1}{m^{x^3}m^{x^3p}}\right)^{36} \\
    &= \underbrace{\left(\frac{1}{m}\right)^2 \cdot \left(\frac{1}{m^{x}}\right)^{18}\left(\frac{1}{m^{x^2}}\right)^{30}\left(\frac{1}{m^{x^3}}\right)^{36}}_{m^{\lambda_0}}\cdot \underbrace{m^p \cdot \left(\frac{1}{m^{xp}}\right)^{12} \cdot \left(\frac{1}{m^{x^2p}}\right)^{18} \cdot \left(\frac{1}{m^{x^3p}}\right)^{36}}_{m^{\lambda_1p}} \cdot \underbrace{m^{p^2} \cdot (m^{x^2p^2})^6}_{m^{\lambda_2p^2}} \cdot \underbrace{m^{p^3}}_{m^{\lambda_3p^3}} \\
    &= m^{\lambda_0} \cdot m^{\lambda_1p} \cdot m^{\lambda_2p^2} \cdot m^{\lambda_3p^3} = m^{\lambda_0 + \lambda_1p + \lambda_2p^2 + \lambda_3p^3} = m^{\frac{p^4-p^2+1}{r}}
    \end{aligned}
    $$

</details>

    To compute this product as efficient as possible, we use the vectorial addition chain technique as explained in the last part of Section 5 of [2008/490](https://eprint.iacr.org/2008/490.pdf):
$$
\begin{aligned}
T_{0,1} &= y_6^2\cdot y_4 \cdot y_5, \\
T_{1,1} &= T_{0,1} \cdot y_3 \cdot y_5, \\
T_{0,2} &= T_{0,1} \cdot y_2, \\
T_{1,2} &= T_{1,1}^2 \cdot T_{0,2}, \\
T_{1,3} &= T_{1,2}^2, \\
T_{1,4} &= T_{1,3} \cdot y_0, \\
T_{0,3} &= T_{1,3} \cdot y_1, \\
T_{0,4} &= T_{0,3}^2 \cdot T_{1,4}.
\end{aligned}
$$
which requires only $9$ multiplications and $4$ squarings.

**Costs:** $$\underbrace{(63·3)S + (x·3)M}_{\text{Step 1}} + \underbrace{5 · (6\tilde{c} + 5\tilde{m}) + 2·(5\tilde{m})}_{\text{Step 2}} + \underbrace{4M + 5C}_{\text{Step 3}} + \underbrace{9M + 4S}_{\text{Step 4}}$$

## Frobenius Operator

As we have shown, in the final exponentation we must compute the first, second and third Frobenius operator $\pi_p,\pi_p^2,\pi_p^3$ over an element in $\mathbb{F}_{p^{12}}$. Recalling that $\pi_p^i(x) = x^{p^i}$, a naive implementation would take $O(\log p) = O(254)$ $\mathbb{F}_{p^{12}}$-operations, but we will do it much better.

Recall that we can write any element $f \in \mathbb{F}_{p^{12}}$ as:
$$
f = g + h w = g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5
$$
where $g = g_0 + g_1v + g_2v^2$ and $h = h_0 + h_1v + h_2v^2$ with $g,h \in \mathbb{F}_{p^{6}}$ and $g_i,h_i \in \mathbb{F}_{p^2}$.

<details><summary>Expand to see the proof</summary>

We will now show that raising an $\mathbb{F}_{p^2}$-element over any power of $p$ is almost cost free and therefore so is $f$.
- Take $b = b_0 + b_1u \in \mathbb{F}_{p^2}$ with $b_0,b_1 \in \mathbb{F}_{p}$. Then, $b^{p^{2i}} = b_0 + b_1(u^{(p^{2})^i}) = b_0 + b_1u = b$ for Lagrange theorem. Similarly, $b^{p^{2i-1}} =  \frac{b^{p^{2i}}}{b^{p^2} \cdot b^p} = \frac{b}{b \cdot b^{-p}} = \frac{1}{b^{-p}} = b^p = \bar{b}$.
- Notice $w^p = (w^6)^{\frac{p-1}{6}}w = (9+u)^{\frac{p-1}{6}}w$ and therefore $(w^{i})^p = \gamma_{1,i}w^i$, where $\gamma_{1,i} = (9+u)^{i\frac{p-1}{6}}$.

Using all the previous observations, we have:
$$
\begin{aligned}
f^p &= (g_0 + h_0w + g_1w^2 + h_1w^3 + g_2w^4 + h_2w^5)^p \\
    &= \bar{g}_0 + \bar{h}_0w^p + \bar{g}_1w^{2p} + \bar{h}_1w^{3p} + \bar{g}_2w^{4p} + \bar{h}_2w^{5} \\
    &= \bar{g}_0 + \bar{h}_0\gamma_{1,1}w + \bar{g}_1\gamma_{1,2}w^2 + \bar{h}_1\gamma_{1,3}w^3 + \bar{g}_2\gamma_{1,4}w^4 + \bar{h}_2\gamma_{1,5}w^5,
\end{aligned}
$$
which can be computed using a few multiplications and a few conjugations, assuming each $\gamma_{1,i}$ is pre-computed for $i \in [5]$.

Similarly, notice $w^{p^2} = (9+u)^{\frac{p^2-1}{6}}w = (\gamma_{1,1})^{1+p}w = \gamma_{1,1} \cdot \bar{\gamma}_{1,1}w$ and therefore $(w^{i})^{p^2} = \gamma_{2,i}w^i$, where $\gamma_{2,i} = \gamma_{1,i} \cdot \bar{\gamma}_{1,i}$. 

Lastly, we can use the identity $p^3-1 = p^2(p-1) + (p+1)(p-1)$ to show that
$w^{p^3} = (9+u)^{\frac{p^3-1}{6}}w = (\gamma_{1,1})^{p^2} \cdot \gamma_{2,1}w = \gamma_{1,1} \cdot \gamma_{2,1}w$ and therefore $(w^{i})^{p^3} = \gamma_{3,i}w^i$, where $\gamma_{3,i} = \gamma_{1,i} \cdot \gamma_{2,i}$. 

</details>

Then, we have:
$$
\begin{aligned}
f^{p} = \bar{g}_0 + \bar{h}_0\gamma_{1,1}w + \bar{g}_1\gamma_{1,2}w^2 + \bar{h}_1\gamma_{1,3}w^3 + \bar{g}_2\gamma_{1,4}w^4 + \bar{h}_2\gamma_{1,5}w^5, \\
f^{p^2} = g_0 + h_0\gamma_{2,1}w + g_1\gamma_{2,2}w^2 + h_1\gamma_{2,3}w^3 + g_2\gamma_{2,4}w^4 + h_2\gamma_{2,5}w^5, \\
f^{p^3} = \bar{g}_0 + \bar{h}_0\gamma_{3,1}w + \bar{g}_1\gamma_{3,2}w^2 + \bar{h}_1\gamma_{3,3}w^3 + \bar{g}_2\gamma_{3,4}w^4 + \bar{h}_2\gamma_{3,5}w^5,
\end{aligned}
$$
with $\gamma_{1,i} = (9+u)^{i\frac{p-1}{6}}$, $\gamma_{2,i} = (9+u)^{i\frac{p^2-1}{6}} = \gamma_{1,i} \cdot \bar{\gamma}_{1,i}$ and $\gamma_{3,i} = (9+u)^{i\frac{p^3-1}{6}} = \gamma_{1,i} \cdot \gamma_{2,i}$. Hence, assuming the precomputation of $\gamma_{1,i},\gamma_{2,i},\gamma_{3,i}$ for $i \in [5]$, we can compute $f^p,f^{p^2}$ or $f^{p^3}$ almost for free.

**Costs:** $\underbrace{6\tilde{c} + 5\tilde{m}}_{f^p}, \quad \underbrace{5\tilde{m}}_{f^{p^2}}, \quad \underbrace{6\tilde{c} + 5\tilde{m}}_{f^{p^3}}$

## Speeding up Computations in the Cyclotomic Subgroup

I follow [2010/542](https://eprint.iacr.org/2010/542.pdf) closely for this section.

Recall that:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 + 1), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - (9+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v).
\end{aligned}
$$
and also:
$$
\mathbb{F}_{p^{12}} = \mathbb{F}_{p^2}[w]/(w^6 - (9+u))
$$

For this optimitzation, we will further need the following $\mathbb{F}_{p^{12}}$ representation:
$$
\begin{aligned}
\mathbb{F}_{p^{4}} &= \mathbb{F}_{p^2}[w^3]/((w^3)^2 - (9+u)), \\
\mathbb{F}_{p^{12}} &= \mathbb{F}_{p^4}[w]/(w^3 - w^3),
\end{aligned}
$$
so that for $f = (g_0 + g_1 w^3) + (g_2 + g_3 w^3) w + (g_4 + g_5 w^3) w^2 \in C$, we can equivalently write $f = g_0 + g_2 w + g_4 w^2 + g_1 w^3 + g_3 w^4 + g_5 w^5 \in B$.

This optimization is due to "compression" and "decompression" technique, which exploits the algebraic relationships arising from elements belonging to the cyclotomic subgroup $\mathbb{G}_{\phi_{6}(p^2)}$.

### Compression and Decompression

If $f = g_0 + g_2w + g_4w^2 + g_1w^3 + g_3w^4 + g_5w^5$ then the compression function $\mathcal{C}$ is:
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
\tilde{g}_1 = \frac{\tilde{g}_5^2(9+u) + 3\tilde{g}_4^2 - 2\tilde{g}_3}{4\tilde{g}_2}, \quad \tilde{g}_0 = (2\tilde{g}_1^2 + \tilde{g}_2\tilde{g}_5 - 3\tilde{g}_3\tilde{g}_4)(9+u) + 1, & \text{if } \tilde{g}_2 \neq 0 \\
\tilde{g}_1 = \frac{2\tilde{g}_4\tilde{g}_5}{\tilde{g}_3}, \qquad\qquad\quad \tilde{g}_0 = (2\tilde{g}_1^2 - 3\tilde{g}_3\tilde{g}_4)(9+u) + 1, & \text{if } \tilde{g}_2 = 0
\end{cases}
$$

### Compressed Squaring

Now, on input $f \in \mathbb{G}_{\phi_{6}(p^2)}$ we will be able to compute its square on compressed form. That is, $\mathcal{C}(f^2) = [h_2, h_3, h_4, h_5]$, where $h = f^2 = h_0 + h_2w + h_4w^2 + h_1w^3 + h_3w^4 + h_5w^5$:
$$
\begin{aligned}
h_2 &= 2(g_2 + 3(9+u)B_{4,5}), \\
h_3 &= 3(A_{4,5} - (10 + u)B_{4,5}) - 2g_3, \\
h_4 &= 3(A_{2,3} - (10+u)B_{2,3}) - 2g_4, \\
h_5 &= 2(g_5 + 3B_{2,3}), \\
A_{i,j} &= (g_i + g_j)(g_i + (9+u)g_j), \\
B_{i,j} &= g_i \cdot g_j.
\end{aligned}
$$

### Exponentiation in the Cyclotomic Subgroup

Given $f \in \mathbb{G}_{\phi_{6}(p^2)} \subset \mathbb{F}_{p^{12}}^*$ and $e \geq 1$, the idea is to compute $f^e$ using the squaring formula in compressed form.

Represent $e$ in binary as $e = e_{\ell-1}e_{\ell-2}\dots e_1e_0$ with $e_{\ell-1}=1$ and define $H_e = \{i : 1 \leq i \leq \ell - 1 \text{ and } e_i = 1\}$. Then:
$$
f^e = \prod_{i=0}^{\ell - 1} f^{e_i \cdot 2^i} = f^{e_0} \prod_{i \in H_e} \mathcal{D}(\mathcal{C}(f)^{2^i}).
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

<!--
## Summary of Costs

### In Terms of Finite Field Arithmetic

Let $(a,m,s,i),(\tilde{a},\tilde{m},\tilde{s},\tilde{i})$ and $(A,M,S,I)$ denote the cost of field addition, multiplication, squaring and inversion in $\mathbb{F}_p, \mathbb{F}_{p^2}$ and $\mathbb{F}_{p^{12}}$, respectively. 

Also, let $\tilde{c}$ and $C$ denote conjugates in $\mathbb{F}_{p^2}$ and $\mathbb{F}_{p^{12}}$, respectively.

Let $E'_{\text{double}}$ and $E'_{\text{add}}$ denote point doubling and addition in $E'$. Finally, let $\ell_{\text{eq}}$ and $\ell_{\text{diff}}$ denote the cost of evaluating lines between equal and different $E(\mathbb{F}_{p^{12}})$ points.

**Costs Subgroup Checks:** $$\underbrace{2s + 1m + 1a}_{\mathbb{G}_1} + \underbrace{2\tilde{c} + 2\tilde{m}}_{\mathbb{G}_2}$$
**Costs Loop:** 
$$
\begin{aligned}
\underbrace{64·(1S + 1M + 1\ell_{\text{eq}} + E'_{\text{double}})}_{\text{"double"}} + \underbrace{25·(1M + 1\ell_{\text{diff}} + E'_{\text{add}})}_{\text{"and add"}} = \\[0.2cm]
= 64·(1S + 1M + [1\tilde{a} + 2\tilde{s} + 2\tilde{m} + 10m] + [2\tilde{m} + 2\tilde{s} + \tilde{i}]) + 25·(1M + [3\tilde{a} + 2\tilde{m} + 4m] + [2\tilde{m} + \tilde{s} + \tilde{i}]) = \\[0.2cm]
= 64·(1S + 1M + 1\tilde{a} + 4\tilde{m} + 4\tilde{s} + \tilde{i} + 10m) + 25·(1M + 3\tilde{a} + 4\tilde{m} +\tilde{s} + \tilde{i} + 4m) = \\[0.2cm]
= 64S + 89M + 125\tilde{a} + 356\tilde{m} + 281\tilde{s} + 89\tilde{i} + 740m
\end{aligned}
$$

**Costs Between Loop and Final Exponentiation:** $$\underbrace{2\tilde{c} + 2\tilde{m}}_{Q'} + \underbrace{2\tilde{c} + 2\tilde{m} + 2m}_{Q''} + 1E'_{\text{add}} + 2M + 2\ell_{\text{diff}}$$
**Costs Final Exponentiation:** $$\underbrace{1C + 1I + 1M + 5\tilde{m} + 1M}_{\text{Easy Part}} + \underbrace{(63·3)S + (x·3)M + 5 · (6\tilde{c} + 5\tilde{m}) + 2·(5\tilde{m}) + 4M + 5C + 9M + 4S}_{\text{Hard Part}}$$

Let $(a,m,s,i)$ and $(\tilde{a},\tilde{m},\tilde{s},\tilde{i})$ denote the cost of field addition, multiplication, squaring and inversion in $\mathbb{F}_{p}$ and $\mathbb{F}_{p^2}$, respectilvey. Finally, let $m_{\xi}$ denote the cost of multiplying an arbitrary element from $\mathbb{F}_{p^2}$ by the constant $\xi = 9+u$. 

Assume:
$$
\tilde{m} \leq 4m + 2a, \quad \tilde{s} \leq 2m + 2s + 1a, \quad \tilde{a} \leq 2a, \quad m_{\xi} \leq 2m + 2a
$$

**Costs Loop:** 
$$
\begin{aligned}
6912\tilde{a} + 1952\tilde{m} + 568\tilde{s} + 294m + 400m_{\xi}
\end{aligned}
$$

**Costs Final Exponentiation:** $$7021\tilde{a} + 403\tilde{m} + 1719\tilde{s} + \tilde{i} + 80m + 898m_{\xi}$$

**Total:**
$$
\begin{aligned}
13933\tilde{a} + 2355\tilde{m} + 2287\tilde{s} + \tilde{i} + 374m + 1298m_{\xi} \leq 37459a + 16964m + 4574s
\end{aligned}
$$

Numbers have been extracted from Table 2 of [2010/354](https://eprint.iacr.org/2010/354.pdf). However, keep in mind that they represent points in $E'(\mathbb{F}_{p^2})$ in Jacobian coordiantes for both line equations and elliptic curve operations, obtaining a lower number of multiplications (than in affine coordinates) and avoiding field inversions, respectively. 

### In Terms of R1CS Constraints

I will use [circom-pairing](https://github.com/yi-sun/circom-pairing) as the implementation reference for such counting. In this implementation, they decided to split elements from $\mathbb{F}_p$ in both $5$ limbs of $51$-bits each and $6$ limbs of $43$-bits each. They do so because circom natively supports finite field arithmetic over the scalar field $\mathbb{F}_r$ of the BN254 curve but not over the base field $\mathbb{F}_p$ of the BN254 curve, so one should implement $\mathbb{F}_p$-arithmetic over $\mathbb{F}_r$-arithmetic as efficiently as possible.

|    Limbs     | Non-Linear Constraints | Linear Constraints |
|:------------:|:----------------------:|:------------------:|
| 5 of 51-bits |        8333384         |       479700       |
| 6 of 43-bits |        8108878         |       555906       |
-->

## Appendix A: Field Isomorphisms

Recall that:
$$
\begin{aligned}
\mathbb{F}_{p^2} &= \mathbb{F}_p[u]/(u^2 + 1), \\
\mathbb{F}_{p^6} &= \mathbb{F}_{p^2}[v]/(v^3 - (9+u)), \\
A = \mathbb{F}_{p^{12}} &= \mathbb{F}_{p^6}[w]/(w^2 - v).
\end{aligned}
$$

We use two additional representations of $\mathbb{F}_{p^{12}}$. 

The first one is used to efficiently compute the [Frobenius operator](#frobenius-operator) and is as follows:
$$
B = \mathbb{F}_{p^{12}} = \mathbb{F}_{p^2}[w]/(w^6 - (9+u)).
$$

The second one is used to [speed up the squares and exponentations](#speeding-up-computations-in-the-cyclotomic-subgroup) in the hard part of the final exponentiation:
$$
\begin{aligned}
\mathbb{F}_{p^{4}} &= \mathbb{F}_{p^2}[w^3]/((w^3)^2 - (9+u)), \\
C = \mathbb{F}_{p^{12}} &= \mathbb{F}_{p^4}[w]/(w^3 - w^3).
\end{aligned}
$$

### Isomorphism between A and B

We start with $A = \mathbb{F}_{p^6}[w]/(w^2 - v)$ and $B = \mathbb{F}_{p^2}[w]/(w^6 - (9+u))$, where we notice that if we take $a = a_1 + a_2 \cdot w \in A$, we can use the identity $v = w^2$ to rewrite it as:
$$
\begin{aligned}
a &= (a_{1,1} + a_{1,2}v + a_{1,3}v^2) + (a_{2,1} + a_{2,2}v + a_{2,3}v^2) \cdot w = \\[0.1cm]
&= a_{1,1} + a_{2,1} \cdot w + a_{1,2} \cdot w^2 + a_{2,2} \cdot w^3 + a_{1,3} \cdot w^4 + a_{2,3} \cdot w^5 \in B
\end{aligned}
$$

This relationship induces the following field isomorphism $\chi_{AB} : A \to B$ and its inverse $\chi_{AB}^{-1} : B \to A$:
$$
\begin{aligned}
\chi_{AB}(a_{1,1},a_{1,2},a_{1,3},a_{2,1},a_{2,2},a_{2,3}) &= (a_{1,1},a_{2,1},a_{1,2},a_{2,2},a_{1,3},a_{2,3}), \\[0.1cm]
\chi_{AB}^{-1}(b_1,b_2,b_3,b_4,b_5,b_6) &= (b_1,b_3,b_5,b_2,b_4,b_6). 
\end{aligned}
$$

**Exercise:** Check that $\chi_{AB}$ is a field isomorphism between $A$ and $B$ and that for all $a \in A$ and $b \in B$ it is true that $\chi_{AB}^{-1}(\chi_{AB}(a)) = a$ and $\chi_{AB}(\chi_{AB}^{-1}(b)) = b$.

### Isomorphism between B and C

We continue with $B = \mathbb{F}_{p^2}[w]/(w^6 - (9+u))$ and $C = \mathbb{F}_{p^4}[w]/(w^3 - w^3)$, for which we notice that $c = (c_1 + c_2 \cdot w^3) + (c_3 + c_4 \cdot w^3)w + (c_5 + c_6 \cdot w^3) \cdot w^2 \in C$ can be equivalently written as $c_1 + c_3 \cdot w + c_5 \cdot w^2 + c_2 \cdot w^3 + c_4 \cdot w^4 + c_6 \cdot w^5 \in B$.

This relationship induces the following field isomorphism $\chi_{BC} : B \to C$ and its inverse $\chi_{BC}^{-1} : C \to B$:
$$
\begin{aligned}
\chi_{BC}(b_1,b_2,b_3,b_4,b_5,b_6) &= (b_1,b_4,b_2,b_5,b_3,b_6), \\
\chi_{BC}^{-1}(c_1,c_2,c_3,c_4,c_5,c_6) &= (c_1,c_3,c_5,c_2,c_4,c_6). 
\end{aligned}
$$

**Exercise:** Check that $\chi_{BC}$ is a field isomorphism between $B$ and $C$ and that for all $b \in B$ and $c \in C$ it is true that $\chi_{BC}^{-1}(\chi_{BC}(b)) = b$ and $\chi_{BC}(\chi_{BC}^{-1}(c)) = c$.

## Appendix B: Finite Field Arithmetic

### Fp2 Arithmetic

Addition
```python
# INPUT: (a = a1 + a2·u), (b = b1 + b2·u) ∈ Fp2, where ai,bi ∈ Fp
# OUTPUT: (c1 + c2·u) = a + b ∈ Fp
c1 = a1 + b1
c2 = a2 + b2
```

Subtraction
```python
# INPUT: (a = a1 + a2·u), (b = b1 + b2·u) ∈ Fp2, where ai,bi ∈ Fp
# OUTPUT: (c1 + c2·u) = a - b ∈ Fp
c1 = a1 - b1
c2 = a2 - b2
```

Multiplication
```python
# INPUT: (a = a1 + a2·u), (b = b1 + b2·u) ∈ Fp2, where ai,bi ∈ Fp
# OUTPUT: (c1 + c2·u) = a·b ∈ Fp
c1 = a1·b1 - a2·b2
c2 = a1·b2 + a2·b1
```

Scalar Multiplication
```python
# INPUT: b ∈ Fp, (a = a1 + a2·u) ∈ Fp2, where ai ∈ Fp
# OUTPUT: (c1 + c2·u) = a·b ∈ Fp
c1 = b·a1
c2 = b·a2
```

Square
```python
# INPUT: (a = a1 + a2·u) ∈ Fp2, where ai ∈ Fp
# OUTPUT: (c1 + c2·u) = a² ∈ Fp
c1 = (a1 - a2)·(a1 + a2)
c2 = 2·a1·a2
```

Inverse
```python
# INPUT: (a = a1 + a2·u) ∈ Fp2, where ai ∈ Fp
# OUTPUT: (c1 + c2·u) = a⁻¹ ∈ Fp
c1 = a1·(a1² + a2²)⁻¹
c2 = -a2·(a1² + a2²)⁻¹
```

### Fp4 Arithmetic

Square
```python
# INPUT: (a = a1 + a2·V) ∈ Fp4, where ai ∈ Fp2
# OUTPUT: (c1 + c2·V) = a² ∈ Fp4
c1 = a2²·(9 + u) + a1²
c2 = (a1 + a2)² - a1² - a2²
```

### Fp6 Arithmetic

Addition
```python
# INPUT: (a = a1 + a2·v + a3·v²),(b = b1 + b2·v + b3·v²) ∈ Fp6, where ai,bi ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a + b ∈ Fp6
c1 = a1 + b1
c2 = a2 + b2
c3 = a3 + b3
```

Subtraction
```python
# INPUT: (a = a1 + a2·v + a3·v²),(b = b1 + b2·v + b3·v²) ∈ Fp6, where ai,bi ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a - b ∈ Fp6
c1 = a1 - b1
c2 = a2 - b2
c3 = a3 - b3
```

Multiplication
```python
# INPUT: (a = a1 + a2·v + a3·v²),(b = b1 + b2·v + b3·v²) ∈ Fp6, where ai,bi ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a·b ∈ Fp6
c1 = [(a2+a3)·(b2+b3) - a2·b2 - a3·b3]·(9+u) + a1·b1
c2 = (a1+a2)·(b1+b2) - a1·b1 - a2·b2 + (9+u)·(a3·b3)
c3 = (a1+a3)·(b1+b3) - a1·b1 + a2·b2 - a3·b3
```

Scalar Multiplication
```python
# INPUT: b ∈ Fp, (a = a1 + a2·v + a3·v²) ∈ Fp6, where ai ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a·b ∈ Fp6
c1 = b·a1
c1 = b·a2
c1 = b·a3
```

The following three algorithms help to compute the [line equations](#line-equations). See the sparse multiplications algorithms of [next section](#fp12-arithmetic) for a full understanding.

Sparse Multiplication A
```python
# INPUT: (a = a1 + a2·v + a3·v²),b = b2·v ∈ Fp6, where ai,b2 ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a·b ∈ Fp6
c1 = b2·a3·(9+u)
c2 = b2·a1
c3 = b2·a2
```

Sparse Multiplication B
```python
# INPUT: (a = a1 + a2·v + a3·v²),(b = b2·v + b3·v²) ∈ Fp6, where ai,bi ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a·b ∈ Fp6
c1 = [(a2 + a3)·(b2 + b3) - a2·b2 - a3·b3]·(9+u)
c2 = a1·b2 + a3·b3·(9+u)
c3 = (a1 + a3)·b3 - a3·b3 + a2·b2
```

Sparse Multiplication C
```python
# INPUT: (a = a1 + a2·v + a3·v²),(b = b1 + b3·v²) ∈ Fp6, where ai,bi ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a·b ∈ Fp6
c1 = a1·b1 + a2·b3·(9+u)
c2 = a2·b1 + a3·b3·(9+u)
c3 = (a1 + a3)·(b1 + b3) - a1·b1 - a3·b3
```

Square
```python
# INPUT: (a = a1 + a2·v + a3·v²) ∈ Fp6, where ai ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a² ∈ Fp6
c1 = 2·a2·a3·(9 + u) + a1²
c2 = a3²·(9 + u) + 2·a1·a2
c3 = 2·a1·a2 - a3² + (a1 - a2 + a3)² + 2·a2·a3 - a1²
```

Inverse
```python
# INPUT: (a = a1 + a2·v + a3·v²) ∈ Fp6, where ai ∈ Fp2
# OUTPUT: (c1 + c2·v + c3·v²) = a⁻¹ ∈ Fp6
c1mid = a1² - (9 + u)·(a2·a3)
c2mid = (9 + u)·a3² - (a1·a2)
c3mid = a2² - (a1·a3)
c1 = (a1² - (9 + u)·(a2·a3))·(a1·c1mid + xi·(a3·c2mid + a2·c3mid))⁻¹
c2 = ((9 + u)·a3² - (a1·a2))·(a1·c1mid + xi·(a3·c2mid + a2·c3mid))⁻¹
c3 = (a2²-a1·a3)·(a1·c1mid + xi·(a3·c2mid + a2·c3mid))⁻¹
```

### Fp12 Arithmetic

Addition
```python
# INPUT: (a = a1 + a2·w),(b = b1 + b2·w) ∈ Fp12, where ai,bi ∈ Fp6
# OUTPUT: (c1 + c2·w) = a + b ∈ Fp12
c1 = a1 + b1
c2 = a2 + b2
```

Subtraction
```python
# INPUT: (a = a1 + a2·w),(b = b1 + b2·w) ∈ Fp12, where ai,bi ∈ Fp6
# OUTPUT: (c1 + c2·w) = a - b ∈ Fp12
c1 = a1 - b1
c2 = a2 - b2
```

Multiplication
```python
# INPUT: (a = a1 + a2·w),(b = b1 + b2·w) ∈ Fp12, where ai,bi ∈ Fp6
# OUTPUT: (c1 + c2·w) = a·b ∈ Fp12
c1 = a1·b1 + a2·b2·v
c2 = (a1+a2)·(b1+b2) - a1·b1 - a2·b2
```

The following two algorithms are used to compute the [line equations](#line-equations) avoiding all multiplications by zero that arise from the sparisity of such equations.

Sparse Multiplication A
```python
# INPUT: (a = a1 + a2·w),(b = b1 + b2·w) ∈ Fp12, where ai ∈ Fp6, b1 = b12·v and b2 = b22·v + b23·v², with b12,b22,b23 ∈ Fp2
# OUTPUT: (c1 + c2·w) = a·b ∈ Fp12
c1 = a1·b1 + a2·b2·v
c2 = (a1+a2)·[(b12+b22)·v + b23·v²] - a1·b1 - a2·b2
```

Sparse Multiplication B
```python
# INPUT: (a = a1 + a2·w),(b = b1 + b2·w) ∈ Fp12, where ai ∈ Fp6, b1 = b11 + b13·v² and b2 = b22·v, with b11,b13,b22 ∈ Fp2
# OUTPUT: (c1 + c2·w) = a·b ∈ Fp12
c1 = a1·b1 + a2·b2·v
c2 = (a1+a2)·(b11 + b22·v + b13·v²) - a1·b1 - a2·b2
```

Square
```python
# INPUT: (a = a1 + a2·w) ∈ Fp12, where ai ∈ Fp6
# OUTPUT: (c1 + c2·w) = a² ∈ Fp12
c1 = (a1-a2)·(a1-a2·v) + a1·a2 + a1·a2·v
c2 = 2·a1·a2
```

Inverse
```python
# INPUT: (a = a1 + a2·w) ∈ Fp12, where ai ∈ Fp6
# OUTPUT: (c1 + c2·w) = a⁻¹ ∈ Fp12
c1 = a1·(a1² - a2²·v)⁻¹
c2 = -a2·(a1² - a2²·v)⁻¹
```

First Frobenius Operator
```python
# INPUT: (a = a1 + a2·w) = ((a11 + a12v + a13v²) + (a21 + a22v + a23v²)) ∈ Fp12, where ai ∈ Fp6 and aij ∈ Fp2
# OUTPUT: (c1 + c2·w) = a^p ∈ Fp12
c1 = a̅11     + a̅12·γ12·v + a̅13·γ14·v²
c2 = a̅21·γ11 + a̅22·γ13·v + a̅23·γ15·v²
```

Second Frobenius Operator
```python
# INPUT: (a = a1 + a2·w) = ((a11 + a12v + a13v²) + (a21 + a22v + a23v²)) ∈ Fp12, where ai ∈ Fp6 and aij ∈ Fp2
# OUTPUT: (c1 + c2·w) = a^p² ∈ Fp12
c1 = a11     + a12·γ22·v + a13·γ24·v²
c2 = a21·γ21 + a22·γ23·v + a23·γ25·v²
```

Third Frobenius Operator
```python
# INPUT: (a = a1 + a2·w) = ((a11 + a12v + a13v²) + (a21 + a22v + a23v²)) ∈ Fp12, where ai ∈ Fp6 and aij ∈ Fp2
# OUTPUT: (c1 + c2·w) = a^p³ ∈ Fp12
c1 = a̅11     + a̅12·γ32·v + a̅13·γ34·v²
c2 = a̅21·γ31 + a̅22·γ33·v + a̅23·γ35·v²
```

The following two algorithms are used for computing squarings and exponentiations over the cyclotomic subgroup $\mathbb{G}_{\phi_{6}(p^2)} \subset \mathbb{F}_{p^{12}}$. Luckily for us, this is the case after performing the easy part of the [final exponentiation](#final-exponentiation).

Fast Squaring
```python
# INPUT: (a = a1 + a2·w) ∈ GΦ6(p²), where ai ∈ Fp6
# OUTPUT: ((c11 + c12·v + c13·v²) + (c21 + c22·v + c23·v²)·w) = a² ∈ GΦ6(p²)
[t11,t22] = (a11 + a22·V)²
[t23,t12] = (a21 + a13·V)²
[t13,aux] = (a12 + a23·V)²
t21 = aux·(9+u)
c11 = -2·a11 + 3·t11
c12 = -2·a12 + 3·t23
c13 = -2·a13 + 3·t13
c21 = 2·a21 + 3·t21
c22 = 2·a22 + 3·t22
c23 = 2·a23 + 3·t12
```

Fast Exponentatiation
```python
# INPUT: e, (a = a1 + a2·w) ∈ GΦ6(p²), where e ∈ [0,p¹²-2] ai ∈ Fp6
# OUTPUT: (c = c1 + c2·w) = a^e ∈ GΦ6(p²)
c = a
for i in range(L-2,-1,-1): # L is log2(e)
    c = c² # Use previous algorithm
    if e[i] == 1:
        c = c·a

return c
```

[^conjugate]: if you don't know why, make sure to review [Galois theory](https://kconrad.math.uconn.edu/blurbs/galoistheory/finitefields.pdf). Start by noticing that Galois group $\text{Gal}(\mathbb{F}_{p^{12}}/ \mathbb{F}_{p^{6}})$ is a cyclic group of order $2$ generated by the Frobenius endomorphism $F(X) = X^{p^6}$.

[^NAF]: I recently discoverd that this is just a particular case of the more generic [non-adjacent form (NAF)](https://en.wikipedia.org/wiki/Non-adjacent_form) of a number.
