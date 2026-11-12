---
title: "DEEP Quotients over the Base Field"
summary: "Keep STARK DEEP quotients over the base field by dividing by the minimal polynomial of the out-of-domain point instead of X − z, so base-field columns never touch extension-field arithmetic."
date: 2026-08-27
tags: ["STARKs", "Extension Fields"]
draft: false
hackmd: "https://hackmd.io/T0Uep1fsQMaOzmaCAgdQlA"
---

> Originally described [here](https://github.com/0xPolygon/pil-stark/issues/54).

**TL;DR.** The DEEP quotient $\frac{f(X) - f(z)}{X - z}$ drags every base-field column into extension-field arithmetic, because the pole $z$ lives in $\mathbb{K}$. Replacing the single pole by its full Frobenius orbit — quotienting by the minimal polynomial $m_z \in \mathbb{F}[X]$ instead of $X - z$, and by the remainder $r = f \pmod{m_z}$ instead of the scalar $f(z)$ — keeps numerator, denominator, and quotient entirely over $\mathbb{F}$. Proof size is unchanged, the verifier pays a few extra base multiplications per claim, and the prover's quotient pass drops to base-field cost. The claim proven is *the same claim*, written $\mathbb{F}$-rationally.

## Setting

$\mathbb{F}$ a prime field, $\mathbb{K}/\mathbb{F}$ an extension of degree $d$ (Goldilocks: $d = 3$), $\omega \in \mathbb{F}$ a primitive $n$-th root of unity, $D \subset \mathbb{F}$ the LDE domain. 

In a STARK, the prover constructs the polynomial
$$
F(X) =
\sum_{j=1}^{|\mathcal S|}
\sum_{i=1}^{M_{s_j}}
\epsilon^{\,\left(\sum_{k=1}^{j-1}M_{s_k}\right)+i-1}
\cdot
\frac{f_i(X)-f_i(\omega^{s_j}z)}
{X-\omega^{s_j}z},
$$
where $\mathcal S=\{s_1,\ldots,s_{|\mathcal S|}\}$ is an ordered set of integer offsets, $z,\epsilon\in\mathbb K$ are verifier challenges, and $f_i$ are the committed columns, most of which are defined entirely over $\mathbb F$.

**Where the cost hides.** The quotients are computed pointwise over $D$. For $x \in D \subset \mathbb{F}$ the denominator $x - z$ is a full $\mathbb{K}$-element, so *every* per-point operation is extension arithmetic even when both $f_i(x)$ and $f_i(z)$'s role could be played by base-field data. For a base-field column, the only genuinely $\mathbb{K}$-valued ingredient is the pole. The following trick removes it.

## The Trick

A point $z$ of degree $d$ over $\mathbb{F}$ is $\mathbb{F}$-rationally inseparable from its Frobenius orbit $\{z, z^p, \dots, z^{p^{d-1}}\}$. The monic polynomial with exactly that root set,
$$
m_z(X) \;=\; \prod_{j=0}^{d-1} \big(X - z^{p^j}\big) \;\in\; \mathbb{F}[X],
$$
is the **minimal polynomial** of $z$: it has base-field coefficients, degree $d$, and — being irreducible over $\mathbb{F}$ — no roots in $\mathbb{F}$, so $m_z(x) \neq 0$ for every $x \in D$. Quotient by the orbit instead of the point: the pole set is now Frobenius-stable, and the denominator is a base-field value everywhere on the domain.

## The New Quotient

The scalar $f(z)$ cannot be subtracted anymore: $f - f(z)$ is not divisible by $m_z$. What replaces it is the remainder
$$
r(X) = f(X) \pmod{m_z(X)}, \quad \deg(r) < d,\quad r \in \mathbb{F}[X],
$$
and it is worth holding three equivalent descriptions of it at once:

1. **The Euclidean remainder** of $f$ by $m_z$.
2. **The value $f(z)$, written in the basis $\{1, z, \dots, z^{d-1}\}$.** Generically these powers are an $\mathbb{F}$-basis of $\mathbb{K}$; expand $f(z) = r_0 + r_1 z + \dots + r_{d-1} z^{d-1}$ with $r_j \in \mathbb{F}$, and those coordinates are the coefficients of $r$. Indeed $f - r$ then vanishes at $z$; a polynomial over $\mathbb{F}$ vanishing at $z$ vanishes at the whole orbit (apply Frobenius), hence is divisible by $m_z$; uniqueness of remainders closes the loop.
3. **The unique interpolant of degree $< d$ through the orbit values** $\big(z^{p^j}, f(z)^{p^j}\big)_{j < d}$.

Description 2 is the practical one: the prover *never divides by $m_z$* to obtain $r$. It already holds $v = f(z)$ from the evaluation phase; expressing $v$ in the basis $\{1, z, \dots, z^{d-1}\}$ is one $d \times d$ base-field linear solve — the matrix depends only on the pole, so it is inverted once per opening point and reused across all columns.

It also shows the data is identical: $r$ is $d$ base-field elements, and so was $f(z) \in \mathbb{K}$. The prover sends the same number of field elements, in different coordinates. **Proof size is unchanged.**

## Protocol Delta

For each base-field column $f$ and opening point $z$:

- *Before:* prover sends $v = f(z) \in \mathbb{K}$; the FRI polynomial contains $\dfrac{f(X) - v}{X - z}$; the consistency check consumes $v$ directly.
- *After:* prover sends $r \in \mathbb{F}^{<d}[X]$; the FRI polynomial contains $\dfrac{f(X) - r(X)}{m_z(X)}$; the consistency check for $x \in D$ consumes $r(x)$, which the verifier computes itself.

At a queried position $x \in D$, the verifier's local recomputation of the term is $\big(f(x) - r(x)\big)\cdot m_z(x)^{-1}$, one *base-field* inversion shared per point. Everything left of the $\epsilon$-fold is base-field; the fold itself is $\mathbb{K}\times\mathbb{F}$ scalar multiplications, which is the floor either way, since $F(X)$ is $\mathbb{K}$-valued regardless.

Columns genuinely over $\mathbb{K}$ (the stage-2 / auxiliary columns that absorb verifier challenges) keep the old quotient: their remainder and quotient would live in $\mathbb{K}$ anyway, and nothing is gained. The two kinds of terms coexist in the same $\epsilon$-fold.

## Computing $m_z$

No search is needed: $m_z$ is the conjugate product, and the Frobenius $z \mapsto z^p$ is a fixed $\mathbb{F}$-linear map on $\mathbb{K}$ that can be hardcoded for the tower. Concretely, elementary symmetric functions of $\big(z, z^p, \dots, z^{p^{d-1}}\big)$; for $d = 3$, three conjugates, and $m_z(X) = X^3 - e_1 X^2 + e_2 X - e_3$ with $e_1 = \mathrm{Tr}$-type sums that are automatically in $\mathbb{F}$. Two remarks that tighten the linear-system presentation:

- The degree $\ell$ of $m_z$ is $[\mathbb{F}(z) : \mathbb{F}]$, which **divides** $d$. For prime $d$ (Goldilocks cubic) the only possibilities are $\ell \in \{1, d\}$: the intermediate systems have no solutions, and searching them is wasted work. $\ell = 1$ means $z \in \mathbb{F}$ (probability $p^{1-d}$, i.e. $\approx 2^{-128}$ for $d = 3$), where $m_z = X - z$ and the construction *degrades gracefully to the ordinary quotient*.
- The second pole is free: since $\omega \in \mathbb{F}$ is Frobenius-fixed, the orbit of $\omega z$ is $\omega$ times the orbit of $z$, so
  $$
  m_{\omega z}(X) \;=\; \omega^{\,d}\, m_z(X / \omega), \qquad \text{i.e. coefficient } c_j \mapsto \omega^{\,d-j} c_j .
  $$
  The shift lives in the pole, and the pole-thickening respects it.

## When it Pays

The saving is proportional to the fraction of committed columns over $\mathbb{F}$. In STARK today that is everything except the auxiliary trace — the stage-2 columns (grand products / logup accumulators) absorb $\mathbb{K}$-challenges and stay on the old quotient.

**Remark (generality).** Nothing is specific to $z$ and $\omega z$: the construction applies at any opening point, to any Frobenius-stable batch of points, and over any tower $\mathbb{K}/\mathbb{F}$ — the pole set just has to be closed under $x \mapsto x^p$ and disjoint from the LDE domain, both of which the conjugate orbit of an out-of-domain $z$ gives for free.
