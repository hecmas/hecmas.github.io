---
title: "Elliptic Curves over Goldilocks"
summary: "Building prime-order elliptic curves over a quintic extension of Goldilocks with 128-bit security and efficient hash-to-curve: EcGFp5 and EcMasFp5."
date: 2025-02-24
tags: ["Elliptic Curves", "Goldilocks"]
draft: false
hackmd: "https://hackmd.io/CxJrIhv-SP65W3GWS_J5bw"
---

> The two elliptic curves implementation can be found [here](https://github.com/0xPolygonHermez/pil2-proofman/pull/202/commits/4ee3a2a9e728bdf2fef7d3ccd8a7f928e704d2f2).

We aim to construct an elliptic curve satisfying the following criteria:
- Prime order.
- Efficient group operations.
- Deterministc and efficient hash-to-curve encoding.
- Security level of **128 bits**.

## Extension Field Selection

To achieve the target security level, we adopt an approach similar to [EcGFp5](https://eprint.iacr.org/2022/274.pdf). Specifically, we define the extension field $\mathbb{F}_{p^5} = \mathbb{F}_p[z] / (z^5 - 3)$ over $p = 2^{64} - 2^{32} + 1$ 

We select the polynomial $f(z) = z^5 - 3$ because:
- It has the minimal Hamming weight among irreducible polynomials.
- It uses nonzero coefficients as close to $\pm 1$ as possible.
- A polynomial of the form $z^k - c$ minimizes the computational cost of the Frobenius operator.

The following Sage script verifies that the previous claims about $z^5 - 3$ are true:
```python
# Define Fp
p = 2**64 - 2**32 + 1
F = GF(p)

# Define Fp[z]
R.<z> = PolynomialRing(F)

# Polynomials of the form z⁵±c for c ∈ [0,2] are not irreducible
for i in range(3):
    assert(R(z^5+i).is_irreducible() == R(z^5-i).is_irreducible() == False)
    
# The polynomial z^5-3 is irreducible
assert(R(z^5-3).is_irreducible())
```

### Quadratic Residuosity

To check whether an element $a \in \mathbb{F}_{p^{5}}$ is a quadratic residue, we use [Euler's criterion](https://en.wikipedia.org/wiki/Euler%27s_criterion), raising $a$ to the power $(p^{5}-1)/2$.

This exponentiation can be optimized by noting that:
$$
p^5 - 1 = (p^4 + p^3 + p^2 + p + 1) \cdot (p-1)
$$
which follows from the [cyclotomic polynomial](https://en.wikipedia.org/wiki/Cyclotomic_polynomial) decomposition.

To compute $a$ to the power over $p^4 + p^3 + p^2 + p + 1$, we need to efficiently compute the first and second **Frobenius operator**.  Moreover, notice that when this exponentation is done, we get an element $b \in \mathbb{F}_{p^5}$ such that $b^{p-1} = 1$ and this can only happen when $b \in \mathbb{F}_p$; so the second exponentiation is over $\mathbb{F}_p$ instead.

Exponentiation by $(p-1)/2$ is done by observing that:
$$
\frac{p-1}{2} = 2^{63} - 2^{31},
$$
and using repeated squaring.

### Frobenius Operator

As we have shown in the previous section, we must be able compute the first and second Frobenius operator over an element in $\mathbb{F}_{p^{5}}$ efficiently. A naive implementation would take $O(\log p) = O(64)$ $\mathbb{F}_{p^{5}}$-operations, but we will do it much better.

Write $a$ as $a_0 + a_1z + a_2z^2 + a_3z^3 + a_4z^4$, with $a_i \in \mathbb{F}_{p}$. Then, we can compute the frobenius operators as follows:
$$
\begin{aligned}
a^{p} = a_0 + a_1\gamma_{1,1}z + a_2\gamma_{1,2}z^2 + a_3\gamma_{1,3}z^3 + a_4\gamma_{1,4}z^4, \\
a^{p^2} = a_0 + a_1\gamma_{2,1}z + a_2\gamma_{2,2}z^2 + a_3\gamma_{2,3}z^3 + a_4\gamma_{2,4}z^4,
\end{aligned}
$$
with $\gamma_{1,i} = 3^{i\frac{p-1}{5}}$ and $\gamma_{2,i} = 3^{i\frac{p^2-1}{5}} = \gamma_{1,i}^2$. Hence, assuming the precomputation of $\gamma_{1,i},\gamma_{2,i}$ for $i \in [4]$, we can compute $a^p$ and $a^{p^2}$ by four multiplications each.

<details><summary>Expand to see the proof</summary>

**Proof**:
On the one hand, using [Fermat's little theorem](https://en.wikipedia.org/wiki/Fermat%27s_little_theorem) we have that $a_j^{p^i} = a_j$.

On the other hand, notice $z^p = (z^5)^{\frac{p-1}{5}}z = 3^{\frac{p-1}{5}}z$ and therefore $(z^{i})^p = \gamma_{1,i} \cdot z^i$, where $\gamma_{1,i} = 3^{i\frac{p-1}{5}}$.

Using the previous observations, we have:
$$
\begin{aligned}
a^p &= (a_0 + a_1z + a_2z^2 + a_3z^3 + a_4z^4)^p = a_0 + a_1z^p + a_2z^{2p} + a_3z^{3p} + a_4z^{4p} \\
    &= a_0 + a_1\gamma_{1,1}z + a_2\gamma_{1,2}z^2 + a_3\gamma_{1,3}z^3 + a_4\gamma_{1,4}z^4,
\end{aligned}
$$
which can be computed using a few multiplications.

Similarly, notice $z^{p^2} = 3^{\frac{p^2-1}{5}}z = (\gamma_{1,1})^{p+1}z = \gamma_{1,1}^2 \cdot z$ and therefore $(z^{i})^{p^2} = \gamma_{2,i}z^i$, where $\gamma_{2,i} = \gamma_{1,i}^2$.

**TODO**: Develop on $\gamma_{1,i} = 3^{i\frac{p-1}{5}}$ generating a subgroup of order $5$.

</details>

Playing a little bit, we can refine exponentiation by $p^4 + p^3 + p^2 + p + 1$:
$$
\begin{aligned}
t_0 &:= a^{p} \cdot a^{p^2}, \\
t_1 &:= t_0^{p^2}, \\
t_2 &:= t_0 \cdot t_1, \\
t_3 &:= a \cdot t_2 = a_0 \cdot b_0 + 3 \cdot (a_1 \cdot b_4 + a_2 \cdot b_3 + a_3 \cdot b_2 + a_4 \cdot b_1),
\end{aligned}
$$
where $b := t_2$ is viewed as a $\mathbb{F}_{p^5}$-element.

### Square Roots

To compute the square root of an element $b \in \mathbb{F}_{p^{5}}$ we will use in our favour the fact that to check its quadratic residuosity we have to raise it to $p^4 + p^3 + p^2 + p + 1$. 

After a bit of algebra, we get the following identity:
$$
\frac{1}{2} + \frac{p^4 + p^3 + p^2 + p + 1}{2} = \left(\frac{p+1}{2}\right)p^3 + \left(\frac{p+1}{2}\right)p + 1,
$$
so we can compute the squaring by:
- Compute the square of $b^{-(p^4 + p^3 + p^2 + p + 1)}$ by using any squaring algorithms over the base field (recall that when an element is raised to $p^4 + p^3 + p^2 + p + 1$ it gets mapped to the base field).
- Compute the exponentiation of $b$ by the RHS of the identity.
- Multiply both results.

## EcGFp5

### Definition

Found by [Thomas Pornin](https://eprint.iacr.org/2022/274.pdf), the EcGFp5 curve is defined by the equation:
$$
E/\mathbb{F}_{p^5} : y^2 = x^3 + ax + b
$$
with constants:
$$
\begin{aligned}
a &= 6148914689804861439 + 263z, \\
b &= 15713893096167979237 + 6148914689804861265z
\end{aligned}
$$
and order $2n$ for the $319$-bit prime:

```
n = 0x7ffffffd800000077ffffff1000000167fffffe6cfb80639e8885c39d724a09ce80fd996948bffe1
```

Since $n$ is odd, the points belonging to the subgroup of order $n$ are precisely the $n$-torsion $E[n]$ of the curve.

### Hashing to the Curve

We follow the [RFC 9380: Hashing to Elliptic Curves](https://www.rfc-editor.org/rfc/rfc9380.html) to get a deterministic mapping.

```
hash_to_curve(msg)

Input: msg, an arbitrary-length byte string.
Output: P, a point in G.

Steps:
1. u = hash_to_field(msg, 2)
2. Q0 = map_to_curve_simple_swu(u[0])
3. Q1 = map_to_curve_simple_swu(u[1])
4. R = Q0 + Q1
5. P = R + R # clear_cofactor(R)
6. return P

––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

map_to_curve_simple_swu(u)

Input: u, an element in Fp5.
Output: P, a point in E.

Steps:
1. tv1 = inv0(Z^2 * u^4 + Z * u^2)
2.  x1 = (-B / A) * (1 + tv1)
3.  If tv1 == 0, set x1 = B / (Z * A)
4. gx1 = x1^3 + A * x1 + B
5.  x2 = Z * u^2 * x1
6. gx2 = x2^3 + A * x2 + B
7.  If is_square(gx1), set x = x1 and y = sqrt(gx1)
8.  Else set x = x2 and y = sqrt(gx2)
9.  If sgn0(u) != sgn0(y), set y = -y
10. return (x, y)
```

## EcMasFp5

### Definition

We choose the short Weierstrass equation:
$$
y^2 = x^3 + Ax + B 
$$
because assuming that $A \in \mathbb{F}_p^*$ and that the cost of addition, subtraction, multiplication and division over the field is the same (something true in SNARK settings), point addition costs $10$ field operations and point doubling costs $12$ field operations.

Setting $A \in \mathbb{F}_p^*$ also restricts $B$ to be from the extension field, rather from the prime field; otherwise the curve could not be of primer order.

Since $B$ has no impact in group operations, we perform a linear search:
```python
# Define Fp⁵
K.<z> = GF(p^5, modulus=z^5-3)

# Perform a linear search
def find_ec_over_gfp5(initial_a = 0, initial_c = 1, attempts = 50, pol_degree = K.degree(), verbose = True):
    A = initial_a
    c = initial_c
    if verbose:
        print("· Attempting with A =", A)
    while True:
        for i in range(1, pol_degree):
            B = c * z**i
            E = EllipticCurve(K, (A, B))
            if verbose:
                print("    -",E)
            if is_prime(E.order(algorithm="pari")):
                print(f"Elliptic curve found with A = {E.a4()} and B = {E.a6()}")
                return E
        else:
            c += 1
            # If no prime order was found, reset `c` and update `A`
            if c == attempts:
                c = initial_c
                A += 1
                if verbose:
                    print("· Attempting with A =", A)
            continue

        break
        
E = find_ec_over_gfp5()
```

The first elliptic curve found was:
$$
E/\mathbb{F}_{p^5}: y^2 = x^3 + 3x + 8z^4,
$$
with a $320$-bit prime order:
```
n = 0xfffffffb0000000effffffe20000002cffffffcc2c13f5f892042da0dfcde3fc8f4b2caf22360ee3
```

The name for this curve was chosen to be **EcMasFp5** (**E**lliptic **C**urve for **M**aximum **A**ggregation **S**peed over $\mathbb{F}_{p^5}$).

### Security of the Curve

> Thanks to [Robin Salen](https://github.com/Nashtare) for help and discussion.

We follow the criteria in [Safe Curves](https://safecurves.cr.yp.to/index.html).

#### Summary

```
Curve prime order `n`: 0xfffffffb0000000effffffe20000002cffffffcc2c13f5f892042da0dfcde3fc8f4b2caf22360ee3 (320 bits)
Curve cofactor: 1
Curve embedding degree: n-1 (320 bits)
Curve CM discriminant `D`: -0x350910d76c19ff80472df1f236bda8f251edc59a20563b4f1bcb88ad47f9892d334755425f4369e43 (323 bits)
Curve security (Pollard-Rho): 159.83 bits

Twist prime order `nt`: 0x128ad28934008b50864257bbff0983af9688b4f04ff3f024f86f (205 bits)
Twist cofactor: 0xdce68ed7aef21329a0ac97d33d76f (116 bits)
Twist embedding degree: (nt-1)/15 (201 bits)
Twist CM discriminant: D (323 bits)
Twist security (Pollard-Rho): 101.93 bits
```

More details are given below.

#### Field

Since the extension field is the same as the one in [EcGFp5](https://eprint.iacr.org/2022/274.pdf), we inherit by default its security. In particular, this field selection approximately achieves a $142$-bit security level, well beyond the target one.

#### Embedding Degree

We use the following code to find the embedding degree $e$:
```python
def embedding_degree(q,n):  
    F = GF(n)  
    return F(q).multiplicative_order()
```
Finding that $e = n-1$, as large as it can possibly be, avoiding MOV-type attacks.

#### CM Discriminant

The CM Discriminant $D = t^2-4q$ was found to be a $323$-bit integer:
```
D = -0x350910d76c19ff80472df1f236bda8f251edc59a20563b4f1bcb88ad47f9892d334755425f4369e43
```

#### Twist

The number $q+1+t$ factorizes as:
```
0x128ad28934008b50864257bbff0983af9688b4f04ff3f024f86f*0xdce68ed7aef21329a0ac97d33d76f
```

### Hashing to the Curve

It is the same as the one for EcFp5 with the exception that this one does not need to clean the cofactor.

## Resources

- [EcGFp5: a Specialized Elliptic Curve](https://eprint.iacr.org/2022/274.pdf) - Thomas Pornin (2022/274).
- [SP1 Turbo Memory Argument](https://github.com/succinctlabs/sp1/blob/dev/book/static/SP1_Turbo_Memory_Argument.pdf).
- [Safe Curves](https://safecurves.cr.yp.to/index.html).
- [How to Hash into Elliptic Curves](https://eprint.iacr.org/2009/226.pdf) - Thomas Icart (2009/226).
- [RFC 9380: Hashing to Elliptic Curves](ttps://www.rfc-editor.org/rfc/rfc9380.html).
