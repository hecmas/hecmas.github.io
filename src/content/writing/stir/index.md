---
title: "STIR+"
summary: "Notes on STIR-style proximity testing, where each round cuts the degree by k but only halves the domain: the construction, how to handle repeated queries, and round-by-round soundness."
date: 2026-08-28
tags: ["Proximity Testing", "Reed–Solomon"]
draft: false
hackmd: "https://hackmd.io/7qRGUQUCQf-WdPT0u0vmGQ"
---

| Symbol | Meaning |
|---|---|
| $\mathsf{RS}[\mathbb{F},\mathcal{L},d]$ | $\{f:\mathcal{L}\to\mathbb{F} \mid \exists \hat f\in\mathbb{F}^{<d}[X],\ f=\hat f\vert_{\mathcal{L}}\}$ |
| $\rho$ | rate of the code, $\rho := d/\lvert\mathcal{L}\rvert$ |
| $\hat f$ | hat = polynomial object (as opposed to the function $f$) |
| $\mathcal{L}^k$ | $\{x^k : x\in\mathcal{L}\}$ |
| *smooth* | $\mathcal{L}$ is a multiplicative coset of $\mathbb{F}^*$ whose order is a power of 2 |
| $\mathrm{List}(f,d,\delta)$ | codewords of $\mathsf{RS}[\mathbb{F},\mathcal{L},d]$ within distance $\delta$ of $f$ |
| $(\delta,\ell)$-list decodable | $\lvert\mathrm{List}(f,d,\delta)\rvert\le\ell$ for every $f$ |
| $\hat V_S$ | vanishing polynomial of $S$, $\prod_{a\in S}(X-a)$ |

> [!TIP]
> **Fact -- The Johnson Bound**: The code $\mathsf{RS}[\mathbb{F},\mathcal{L},d]$ is $\bigl(1-\sqrt{\rho}-\eta,\ \tfrac{1}{2\eta\sqrt{\rho}}\bigr)$-list decodable for every $\eta\in(0,1-\sqrt{\rho})$.

## 1. The Idea

One STIR iteration reduces proximity testing of $\mathcal{C}=\mathsf{RS}[\mathbb{F},\mathcal{L},d]$ to proximity testing to $\mathcal{C}'=\mathsf{RS}[\mathbb{F},\mathcal{L}',d/k]$, where the **degree drops by a factor $k$ but the domain only drops by a factor 2**:
$$
\rho'=\frac{d/k}{\lvert\mathcal{L}\rvert/2}=\frac{2}{k}\cdot\rho.
$$

Testing proximity to $\mathcal{C}'$ is easier than testing proximity to $\mathcal{C}$ for two reasons:
1. $\mathcal{C}'$ is "smaller" than $\mathcal{C}$ in the sense that the degree is reduced from $d$ to $d/k$ and the evaluation domain size is reduced from $n$ to $n/2$.
2. The rate of the code is reduced by a factor of $2/k$.

Intuitively, testing proximity to a code with a smaller rate is easier because the code has more “redundancy”. Indeed, rate reduction in STIR is the key feature that facilitates smaller query complexity: the smaller the rate, the fewer queries are needed to achieve a target soundness error.

## 2. Tools

STIR rests on the following tools.

### 2.1 Out-of-Domain Sampling

Lemma 4.5 shows that the probability that there exist two distinct codewords in the list-decoding set of a function that both agree on a random point is small.

> [!NOTE]
> **Lemma 4.5**
> If $\mathsf{RS}[\mathbb{F},\mathcal{L},d]$ is $(\delta,\ell)$-list decodable, then
> $$
> \Pr_{r_1,\dots,r_s\leftarrow\mathbb{F}\setminus\mathcal{L}}\bigl[\exists\, u\ne u'\in\mathrm{List}(f,d,\delta):\ \forall i,\ \hat u(r_i)=\hat u'(r_i)\bigr]\ \le\ \frac{d^s\,\ell^2}{2(\lvert\mathbb{F}\rvert-\lvert\mathcal{L}\rvert)^s}
> $$

### 2.2 Folding

STIR relies on k-wise *folding* of functions and polynomials. Lemma 4.9 shows that folding a function preserves its proximity from the Reed–Solomon code with high probability

**Folding Polynomials**: Given a polynomial $\hat{f} \in \mathbb{F}^{<d}[X]$,  a folding parameter $k \in \mathbb{N}$ and $r \in \mathbb{F}$, we define a polynomial $\mathrm{PolyFold}(\hat f,k,r) \in \mathbb{F}^{<d/k}[X]$ as follows. Let $\hat{Q} \in \mathbb{F}[X,Y]$ be the bivariate polynomial derived from $\hat{f}$ with $\deg_X(\hat{Q}) < d /k$ and $\deg_Y(\hat{Q}) < k$ such that $\hat{f}(Z) = \hat{Q}(Z^k, Z)$. Then $\mathrm{PolyFold}(\hat f,k,r)(X) := \hat{Q}(X,r)$.

**Folding Functions**: Let $f : \mathcal{L} \to \mathbb{F}$ be a function, $k \in \mathbb{N}$ a folding parameter and $\alpha \in \mathbb{F}$. For every $x\in\mathcal{L}^k$ let $\hat p_x\in\mathbb{F}^{<k}[X]$ be the polynomial interpolating  $\{f(y): y\in\mathcal{L},\ y^k=x\}$. We define $\mathrm{Fold}(f,k,\alpha): \mathcal{L}^k \to \mathbb{F}$ by $\mathrm{Fold}(f,k,\alpha)(x) := \hat p_x(\alpha)$.

### 2.3 Quotienting

STIR also needs the *quotient* of functions and polynomials.

**Quotienting Functions**: Let $f : \mathcal{L} \to \mathbb{F}$ be a function, $S\subseteq\mathbb{F}$ a set disjoint with $\mathcal{L}$, and $\mathrm{Ans}: S \to \mathbb{F}$ be a function. Let $\widehat{\mathrm{Ans}}\in\mathbb{F}^{<\lvert S\rvert}[X]$ be the polynomial interpolating $\{\mathrm{Ans}(x): x\in S\}$. The *quotient function* $\mathrm{Quotient}(f,S,\mathrm{Ans}): \mathcal{L} \to \mathbb{F}$ is defined by:
$$
\mathrm{Quotient}(f,S,\mathrm{Ans})(x):=\dfrac{f(x)-\widehat{\mathrm{Ans}}(x)}{\hat V_S(x)}
$$

**Quotienting Polynomials**: Let $\hat{f} \in \mathbb{F}^{<d}[X]$ be a polynomial and $S\subseteq\mathbb{F}$. The *polynomial quotient* $\mathrm{PolyQuotient}(\hat f,S) \in \mathbb{F}^{<d - |S|}[X]$ is defined by:
$$
\mathrm{PolyQuotient}(\hat f,S)(X):=\dfrac{\hat f(X)-\widehat{\mathrm{Ans}}(X)}{\hat V_S(X)},
$$
where $\widehat{\mathrm{Ans}}\in\mathbb{F}^{<\lvert S\rvert}[X]$ is the polynomial interpolating $\{\hat f(x): x\in S\}$.

Lemma 4.4 shows that if a function is "quotiented by the wrong value", then its quotient is far from low-degree.

Note that $S$ must be a **set**: if a point appeared twice, $\hat V_S$ would have a double root there while $\hat f - \widehat{\mathrm{Ans}}$ only vanishes to first order, and the honest quotient would not be a polynomial. Section 4 discusses what this means once the points of $S$ are sampled at random.

### 2.4 Degree Correction

Finally, STIR also shows how to properly perform a degree correction.

Given target degree $d \in \mathbb{N}$, shifting parameter $r$, function $f : \mathcal{L} \to \mathbb{F}$, and degree $0 \leq d \leq d^*$, we define $\mathrm{DegCor}(d^*,r,f,d) : \mathcal{L} \to \mathbb{F}$ by:
$$
\mathrm{DegCor}(d^*,r,f,d)(x):=f(x)\sum_{\ell=0}^{d^*-d}(rx)^{\ell}=\begin{cases}f(x)\cdot\dfrac{1-(xr)^{d^*-d+1}}{1-xr} & xr\ne 1\\[2ex] f(x)\cdot(d^*-d+1) & xr=1\end{cases}
$$

The closed form of the geometric sum is the efficiency contribution: **$O(\log(d^*-d))$ operations and a single query to $f$**, instead of $O(d^*-d)$.

### 2.5 Checking the Interpolant: the Shake Polynomial

Quotienting makes the verifier evaluate $\widehat{\mathrm{Ans}}$, the interpolant of $\lvert S\rvert$ points. Interpolating costs $O(\lvert S\rvert^2)$ field operations, and so does the obvious alternative: let the prover send $\widehat{\mathrm{Ans}}$ and check it at every point of $S$, $\lvert S\rvert$ evaluations of a degree-$\lvert S\rvert$ polynomial. Both are the dominant verifier cost of an iteration when $\lvert S\rvert$ is in the hundreds.

The fix is to let the prover send $\widehat{\mathrm{Ans}}$ together with a witness that it interpolates, and check the witness at **one** random point. Define the *shake polynomial*
$$
\mathrm{Sh}(X):=\sum_{a\in S}\frac{\widehat{\mathrm{Ans}}(X)-\mathrm{Ans}(a)}{X-a}.
$$

**The check.** V samples $\rho\leftarrow\mathbb{F}\setminus S$ *after* receiving $\widehat{\mathrm{Ans}}$ and $\mathrm{Sh}$, and accepts iff
$$
\mathrm{Sh}(\rho)=\sum_{a\in S}\frac{\widehat{\mathrm{Ans}}(\rho)-\mathrm{Ans}(a)}{\rho-a}.
$$
**Cost**: two polynomial evaluations and one batched inversion: $O(\lvert S\rvert)$.

Two degree bounds must be enforced for this argument: $\deg(\widehat{\mathrm{Ans}})<\lvert S\rvert$ (a longer polynomial through the same points is not *the* interpolant) and $\deg(\mathrm{Sh})<\lvert S\rvert-1$.

## 3. Construction

### 3.1 Ingredients

- A field $\mathbb{F}$.
- An iteration count $M\in\mathbb{N}$.
- An initial degree $d\in\mathbb{N}$ that is a **power of 2**.
- Folding parameters $k_0,\dots,k_{M-1}\in\mathbb{N}$, powers of two, with $d\ge\prod_i k_i$.
- Evaluation domains $\mathcal{L}_0,\dots,\mathcal{L}_{M-1}\subseteq\mathbb{F}$, each $\mathcal{L}_i$ a smooth coset of $\mathbb{F}^*$ with $\lvert\mathcal{L}_i\rvert>d/\prod_{j<i}k_j$ (i.e. $\rho_i<1$), and $\mathcal{L}_{i-1}^{k_{i-1}}\cap\mathcal{L}_i=\emptyset$ for every $i\in[M-1]$.
- Repetition parameters $t_0,\dots,t_{M-1}\in\mathbb{N}$ with $t_i+1<d/\prod_{j\le i}k_j$ for $i<M-1$.

Per-round degrees, for $i=0,\dots,M$: $\boxed{d_i:=\dfrac{d}{\prod_{j<i}k_j}}$ (so $d_0=d$), and $\rho_i:=d_i/\lvert\mathcal{L}_i\rvert$.

### 3.2 Interaction phase

**Initial function**: $f_0:\mathcal{L}_0\to\mathbb{F}$, an oracle. Honest case: $f_0\in\mathsf{RS}[\mathbb{F},\mathcal{L}_0,d_0]$ and the prover holds $\hat f_0\in\mathbb{F}^{<d_0}[X]$.

**Initial folding**: V sends $r_0^{\mathsf{fold}}\leftarrow\mathbb{F}$.

**Loop**, for $i=1,\dots,M-1$:

1. **Send folded function**. P sends $g_i:\mathcal{L}_i\to\mathbb{F}$. Honest: $g_i$ is the evaluation over $\mathcal{L}_i$ of
   $$\hat g_i:=\mathrm{PolyFold}(\hat f_{i-1},k_{i-1},r_{i-1}^{\mathsf{fold}})\in\mathbb{F}^{<d_i}[X].$$
   *(Note the domain jump: the fold naturally lives on $\mathcal{L}_{i-1}^{k_{i-1}}$, of size $\lvert\mathcal{L}_{i-1}\rvert/k_{i-1}$, but the prover re-evaluates it over $\mathcal{L}_i$, of size $\lvert\mathcal{L}_{i-1}\rvert/2$. That is the "shift to improve rate".)*
2. **Out-of-domain sample**. V sends $r_{i}^{\mathsf{out}}\leftarrow\mathbb{F}\setminus\mathcal{L}_i$.
3. **Out-of-domain reply**. P sends $\beta_{i}\in\mathbb{F}$. Honest: $\beta_{i}:=\hat g_i(r_{i}^{\mathsf{out}})$.
4. **STIR message**. V sends $r_i^{\mathsf{fold}},r_i^{\mathsf{comb}}\leftarrow\mathbb{F}$ and $r_{i,1}^{\mathsf{shift}},\dots,r_{i,t_{i-1}}^{\mathsf{shift}}\leftarrow\mathcal{L}_{i-1}^{k_{i-1}}$.
5. **Quotient set and answers** (both parties, no message). View $\mathcal{G}_i:=\{r_{i}^{\mathsf{out}}\}\cup\{r_{i,1}^{\mathsf{shift}},\dots,r_{i,t_{i-1}}^{\mathsf{shift}}\}$ as a set (repeated shift points counted once, see Section 4), and $\mathrm{Ans}_i:\mathcal{G}_i\to\mathbb{F}$,
   $$
   \mathrm{Ans}_i(r_{i}^{\mathsf{out}})=\beta_{i},\qquad \mathrm{Ans}_i(r_{i,j}^{\mathsf{shift}})=\mathrm{Fold}(f_{i-1},k_{i-1},r_{i-1}^{\mathsf{fold}})(r_{i,j}^{\mathsf{shift}}).
   $$
6. **Interpolant and shake polynomial**. P sends $\widehat{\mathrm{Ans}}_i\in\mathbb{F}^{<\lvert\mathcal{G}_i\rvert}[X]$ and $\mathrm{Sh}_i\in\mathbb{F}^{<\lvert\mathcal{G}_i\rvert-1}[X]$ as coefficients. Honest: $\widehat{\mathrm{Ans}}_i$ interpolates $\mathrm{Ans}_i$ on $\mathcal{G}_i$ and 
   $$
    \mathrm{Sh}_i(X):=\sum_{a\in\mathcal{G}_i} \frac{\widehat{\mathrm{Ans}}_i(X)-\mathrm{Ans}_i(a)}{X-a}.
   $$
8. **Shake challenge**. V sends $\rho_i\leftarrow\mathbb{F}$.
9. **Define next polynomial** (prover-local, no message). With $\hat g_i':=\mathrm{PolyQuotient}(\hat g_i,\mathcal{G}_i)$, the prover defines the degree-corrected polynomial
   $$\hat f_i:=\mathrm{DegCor}\bigl(d_i,\,r_i^{\mathsf{comb}},\,\hat g_i',\,d_i-\lvert\mathcal{G}_i\rvert\bigr)\in\mathbb{F}^{<d_i}[X],$$
   and the protocol proceeds to the next iteration with $\hat f_i$.

**Final round**: P sends $d_M$ coefficients of a polynomial $\hat p\in\mathbb{F}^{<d_M}[X]$; honest $\hat p:=\mathrm{PolyFold}(\hat f_{M-1},k_{M-1},r_{M-1}^{\mathsf{fold}})$.

> [!NOTE]
> The disjointness $\mathcal{L}_{i-1}^{k_{i-1}}\cap\mathcal{L}_i=\emptyset$ is what makes $\mathcal{G}_i\cap\mathcal{L}_i=\emptyset$ automatic (the out-of-domain sample is drawn outside $\mathcal{L}_i$, the shift points live in $\mathcal{L}_{i-1}^{k_{i-1}}$), so the quotient's denominator never vanishes on $\mathcal{L}_i$ and the paper's $\mathrm{Fill}$ polynomial is never needed.

### 3.3 Verifier decision phase

**1. Main loop**, for $i=1,\dots,M-1$:

- (a) For every $j\in[t_{i-1}]$, query $\mathrm{Fold}(f_{i-1},k_{i-1},r_{i-1}^{\mathsf{fold}})$ at $r_{i,j}^{\mathsf{shift}}$. This involves querying $f_{i-1}$ at all $k_{i-1}$ points $x\in\mathcal{L}_{i-1}$ with $x^{k_{i-1}}=r_{i,j}^{\mathsf{shift}}$. (For $i\ge2$, $f_{i-1}$ is the virtual oracle of \(c) below, so each of those is one query to $g_{i-1}$ plus the quotient/degree-correction arithmetic.)
- (b) Build $\mathcal{G}_i$ and $\mathrm{Ans}_i$ as in step 5 of the interaction, and check the shake identity
  $$
  \mathrm{Sh}_i(\rho_i)=\sum_{a\in\mathcal{G}_i}\frac{\widehat{\mathrm{Ans}}_i(\rho_i)-\mathrm{Ans}_i(a)}{\rho_i-a},
  $$
  rejecting if $\rho_i\in\mathcal{G}_i$.Then, (virtually) set, for every $x\in\mathcal{L}_i$,
  $$g_i'(x):=\frac{g_i(x)-\widehat{\mathrm{Ans}}_i(x)}{\hat V_{\mathcal{G}_i}(x)}$$
- \(c) Define the virtual oracle $f_i:\mathcal{L}_i\to\mathbb{F}$ as follows:$$f_i:=\mathrm{DegCor}(d_i,r_i^{\mathsf{comb}},g_i',d_i-\lvert\mathcal{G}_i\rvert)$$ Notice that every query $x$ to $f_i$ translates into **a single** query to $g_i$.

**2. Consistency with the final polynomial**: sample $r_1^{\mathsf{fin}},\dots,r_{t_{M-1}}^{\mathsf{fin}}\leftarrow\mathcal{L}_{M-1}^{k_{M-1}}$ and check
$$\hat p(r_j^{\mathsf{fin}})=\mathrm{Fold}(f_{M-1},k_{M-1},r_{M-1}^{\mathsf{fold}})(r_j^{\mathsf{fin}})\quad\forall j\in[t_{M-1}].$$
This is the only explicit equality check of the protocol. Everything before it binds the prover through quotients: a $g_i$ that disagrees with $\mathrm{Ans}_i$ on $\mathcal{G}_i$ makes $f_i$ far from low degree (Lemma 4.4), and that is what the next iteration's queries detect.

## 4. Repeated Queries

The $t_{i-1}$ shift points are sampled i.i.d. from $\mathcal{L}_{i-1}^{k_{i-1}}$ so they are sampled **with replacement**. Two of them coincide with probability about $\binom{t_{i-1}}{2}/\lvert\mathcal{L}_{i-1}^{k_{i-1}}\rvert$. For concreteness, a schedule with $t_0=200$ queries into a folded domain of $2^{20}$ points collides in around $2.5\%$ of executions, and summing over the quotient rounds of a realistic schedule gives a few percent per proof. This is not a negligible event.

### 4.1 Why it Matters

$\mathcal{G}_i$ enters the protocol as a *set*: in $\hat V_{\mathcal{G}_i}$, in the interpolant $\widehat{\mathrm{Ans}}_i$ and in the degree correction through $\lvert\mathcal{G}_i\rvert$. If a repeated point were kept as a multiset, $\hat V$ would acquire a double root at it while $\hat g_i-\widehat{\mathrm{Ans}}_i$ only vanishes there to first order, so the *honest* $\hat f_i$ would not be a polynomial and the honest prover would fail. If, instead, one party deduplicates and the other does not, they disagree on $\lvert\mathcal{G}_i\rvert$, on $\widehat{\mathrm{Ans}}_i$ and on $\hat V_{\mathcal{G}_i}$, and every honest proof fails. So both parties must apply the same rule, and the rule must produce a set.

### 4.2 Solution A: Deduplicate

Drop every shift point that already occurred. Natively this is a sorted set and costs nothing. Its consequence is that $\lvert\mathcal{G}_i\rvert$ is **data-dependent**: it is only known once the queries are, which is harmless natively but shapes a circuit verifier substantially:

- $\lvert\mathcal{G}_i\rvert$ becomes only known at proving time, so the exponent of the degree correction $\sum_{\ell\le\lvert\mathcal{G}_i\rvert}(r^{\mathsf{comb}}x)^\ell$ is data-dependent.
- $\widehat{\mathrm{Ans}}_i$ and $\mathrm{Sh}_i$ are sent zero-padded to $t_{i-1}+1$ coefficients and the tail beyond $\lvert\mathcal{G}_i\rvert$ must be pinned to zero, to keep the degree bounds of Section 2.5.
- The freshness flags themselves cost $O(t_{i-1}^2)$ comparisons: all quereies are diferent iff $\prod_{i \neq j}(r_i^{\mathsf{shift}}-r_j^{\mathsf{shift}})\ne0$.
- $\hat V_{\mathcal{G}_i}$ cannot be built as a product over a set of unknown size. One builds instead $U(X):=\prod_{q}\bigl(X-\mathrm{fresh}_q\cdot r_q^{\mathsf{shift}}\bigr)=\hat V_{\text{fresh}}(X)\cdot X^{\delta}$, where a dropped repeat contributes the factor $X$ and $\delta$ is the number of drops; $U$ is monic of degree exactly $t_{i-1}$, and the spurious $x^{\delta}$ is divided out at evaluation time.

Deduplication is therefore correct and simple, but it is where most of the STIR-specific circuit cost lives.

### 4.4 Solution B: Hinted Freshness

Keep i.i.d. sampling, but let the prover supply the freshness flags and have the verifier check them in $O(t\log t)$ through a sorted permutation argument instead of recomputing them in $O(t^2)$. This keeps everything in Section 4.2 except the quadratic term, and is only worth it if the sampling cannot be changed.

## 5. Round-by-Round Soundness

Under the hypotheses: $f\notin\mathsf{RS}[\mathbb{F},\mathcal{L}_0,d_0]$,
- $\delta_0\in(0,\Delta(f,\mathsf{RS}[\mathbb{F},\mathcal{L}_0,d_0])]\cap(0,1-\mathsf{B}^\star(\rho_0))$,
- $\delta_i\in\bigl(0,\min\{1-\rho_i-1/\lvert\mathcal{L}_i\rvert,\ 1-\mathsf{B}^\star(\rho_i)\}\bigr)$ for $0<i< M-1$,
- $\mathsf{RS}[\mathbb{F},\mathcal{L}_i,d_i]$ is $(\delta_i,\ell_i)$-list decodable,

STIR has rbr soundness error $(\varepsilon_{\mathsf{fold}},\varepsilon_1^{\mathsf{out}},\varepsilon_1^{\mathsf{shift}},\dots,\varepsilon_{M-1}^{\mathsf{out}},\varepsilon_{M-1}^{\mathsf{shift}},\varepsilon_{\mathsf{fin}})$ with

$$
\begin{aligned}
\varepsilon_{\mathsf{fold}} &\le \mathrm{err}^\star(d_0/k_0,\rho_0,\delta_0,k_0),\\
\varepsilon_i^{\mathsf{out}} &\le \frac{\ell_i^2}{2} \cdot \frac{d_i}{\lvert\mathbb{F}\rvert-\lvert\mathcal{L}_i\rvert},\\
\varepsilon_i^{\mathsf{shift}} &\le (1-\delta_{i-1})^{t_{i-1}}+\mathrm{err}^\star(d_i,\rho_i,\delta_i,t_{i-1}+s)+\mathrm{err}^\star(d_i/k_i,\rho_i,\delta_i,k_i),\\
\varepsilon_i^{\mathsf{shake}} &\le \frac{d_i}{\lvert\mathbb{F}\rvert-\lvert\mathcal{L}_i\rvert}, \\
\varepsilon_{\mathsf{fin}} &\le (1-\delta_{M-1})^{t_{M-1}}.
\end{aligned}
$$

### 5.1 How to read each term

The state function is essentially *"the current fold is within $\delta_i$ of the code"* $\wedge$ *"every consistency-with-$\mathrm{Ans}$ check so far holds"*. The four errors correspond to the four ways the state can flip from 0 to 1:

1. **$\varepsilon_{\mathsf{fold}}$**. The initial folding brings $f$ close to the code by chance.
2. **$\varepsilon_i^{\mathsf{out}}$**. Two distinct codewords of $\mathrm{List}(g_i,d_i,\delta_i)$ agree on the out-of-domain point. If this does **not** happen, there is **at most one** $u$ with $\hat u(r_{i}^{\mathsf{out}})=\beta_{i}$.
3. **$\varepsilon_i^{\mathsf{shift}}$**. Three summands, one per tool:
   - $(1-\delta_{i-1})^{t_{i-1}}$: if that unique $u$ exists, $\hat u$ disagrees with the fold of $f_{i-1}$ on $\ge\delta_{i-1}$ of the domain, so the $t_{i-1}$ shift queries catch it except with that probability.
   - $\mathrm{err}^\star(d_i,\rho_i,\delta_i,t_{i-1}+s)$: `DegCor` with $r_i^{\mathsf{comb}}$ failing to preserve distance.
   - $\mathrm{err}^\star(d_i/k_i,\rho_i,\delta_i,k_i)$: the next fold with $r_i^{\mathsf{fold}}$ failing to preserve distance.
4. **$\varepsilon_{\mathsf{fin}}$**. The final fold agrees with $\hat p$ on all $t_{M-1}$ points despite being $\delta_{M-1}$-far.

## References

- ***STIR**: Reed–Solomon Proximity Testing with Fewer Queries* - Arnon, Chiesa, Fenzi and Yogev [[2024/390]](https://eprint.iacr.org/2024/390.pdf).
- Giacomo Fenzi's [implementation](https://github.com/WizardOfMenlo/stir/).
