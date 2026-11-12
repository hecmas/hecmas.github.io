---
title: "Fast OOD Evaluation"
summary: "Computing a STARK's out-of-domain evaluations quickly with barycentric interpolation over the trace subgroup."
date: 2026-08-26
tags: ["STARKs", "Polynomials"]
draft: false
hackmd: "https://hackmd.io/3Rc9Lf18SbWv0Dqm1cFK6A"
---

## Preliminaries

Let $\mathbb{F}$ be a finite field of prime order $p$ and let $\ell$ be the largest positive integer such that $2^\ell \mid (p-1)$. Let $k < \ell$ and let $G \subset \mathbb{F}^*$ be a multiplicative subgroup of order $n = 2^k$. Also, let $\mathbb{K}$ denote an extension field over $\mathbb{F}$.

The **vanishing polynomial** over a domain $D \subseteq \mathbb{F}^*$ is the monic polynomial whose simple roots are precisely the elements of $D$: $V_D(X) = \prod_{a \in D}(X - a)$. For any multiplicative subgroup $H$ it collapses to $V_H(X) = X^{|H|} - 1$, and for a coset $cH$ to $V_{cH}(X) = X^{|H|} - c^{|H|}$.

## DEEP-ALI

The verifier samples the out-of-domain point $z \leftarrow \mathbb{K} \setminus K$. The prover answers with the **OOD evaluations**: the translated column values and the chunk values
$$
v_{j,s} := w_j(g^s z) \quad (j \in [m],\ s \in \mathcal{S}), \qquad v^Q_i := Q_i(z) \quad (i < \lceil d^{*} / n\rceil).
$$
all computed [barycentrically](#barycentric-evaluation).
The verifier then checks the constraint algebra *on the claims* -- this is the **ALI** identity:
$$
\sum_{i=1}^{\lceil d^{*} / n\rceil} z^{(i-1) \cdot n}\cdot v^Q_i \;\stackrel{?}{=}\; \sum_{t=1}^{m} \beta^{\,t-1}\cdot \frac{C_t\big((v_{j,s})_{j,s}\big)}{V_{H_t}(z)}.
$$
 
**DEEP** is the remaining half: binding the claimed values $v_{j,s}, v^Q_i$ to the *committed* words, which is exactly what the quotients of Step 5 do, at which point "close to a codeword" is also discharged by the proximity test.

## Barycentric Evaluation

Notice that for $x \notin G$:
$$
f(x) = \sum_{u \in G} f(u) \cdot L_u(x) = \frac{V_G(x)}{n} \sum_{u \in G} \frac{u \cdot f(u)}{x - u}.
$$

If we enumerate the elements of $G$ by $u_1,\dots,u_\ell$, the previous can be computed by precomputing the shared constant and vector
$$
\frac{V_G(x)}{n}, \quad \left(\frac{u_1}{x-u_1}, \dots, \frac{u_\ell}{x-u_\ell}\right)
$$
for each $x$ and then computing the inner product per column:
$$
f(x) = \frac{V_G(x)}{n} \cdot \left\langle\left(\frac{u_1}{x-u_1}, \dots, \frac{u_\ell}{x-u_\ell}\right), (f(u_1), \dots, f(u_\ell)) \right\rangle
$$
