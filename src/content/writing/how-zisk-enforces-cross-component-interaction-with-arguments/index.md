---
title: "How ZisK Enforces Cross-Component Interaction with Arguments"
summary: "How ZisK's components (CPU, memory, ALU…) stay consistent: cross-AIR arguments reduced to sumchecks via LogUp, with each component's partial sums combined through proof aggregation."
date: 2026-02-05
tags: ["ZisK", "Lookups", "Sumcheck"]
draft: false
hackmd: "https://hackmd.io/Rb6iaHDBTmqaZBWzX6qm0w"
---

**ZisK** is a zero-knowledge virtual machine (zkVM) that proves the correct execution of programs compiled to the RISC-V instruction set. To achieve this, ZisK arithmetizes an entire computing system (CPU, ALU, memory, and other functional units) into a collection of modular **components**.

Each component is constrained based on an **Algebraic Intermediate Representation (AIR)** using the [PIL2 language](https://github.com/0xPolygonHermez/pil2-compiler), which specifies the polynomial constraints that govern the component's behavior. In this document, we use the terms *component* and *AIR* interchangeably: a component refers to the logical unit (e.g., the CPU or memory), while its AIR refers to the corresponding set of polynomial constraints.

Components operate independently but must interact consistently. For example, when the CPU executes a memory load instruction, it must receive the correct value from the memory component. These cross-component interactions are enforced via **arguments**, which are non-identity constraints that establish relationships between values across different AIRs.

This document describes the argument system used in ZisK, how arguments are reduced to sumchecks via the LogUp protocol, and how proof aggregation combines partial results from independent components into a single, globally consistent proof.

## Preliminaries

Let $\mathbb{F}$ be a finite field of prime order $p$ such that $2^k \vert (p-1)$ for some integer $k \geq 1$. Set $N = 2^k$, and let $G = \langle g \rangle \subseteq \mathbb{F}^*$ be a multiplicative subgroup of order $N$.

An **expression** $e$ is a multivariate polynomial over $\mathbb{F}[X_1, \ldots, X_t]$, where each variable $X_i$ represents a univariate polynomial in $\mathbb{F}^{<N}[X]$ (i.e., a polynomial of degree strictly less than $N$). Given such an expression, we obtain a univariate polynomial via the natural evaluation $e(X) := e(f_1(X), \ldots, f_t(X))$, where $f_1, \ldots, f_t \in \mathbb{F}[X]$ are the polynomials corresponding to $X_1, \ldots, X_t$.

A **selector** is an expression $s$ satisfying $s(x) \in \{0, 1\}$ for all $x \in G$.

Given expressions $e_1, \ldots, e_r$, an **argument** $\mathcal{A}$ is a constraint on the values $\{e_i(x) : x \in G\}$ that cannot be expressed as a polynomial identity. Arguments establish relationships between selected subsets of evaluations over $G$.

## Arguments

In ZisK, we mainly employ four types of arguments:
- **Permutation**: Given two tuples of expressions $(s, e_1, \ldots, e_m)$ and $(\hat{s}, \hat{e}_1, \ldots, \hat{e}_m)$, where $s$ and $\hat{s}$ are selectors, a permutation argument asserts that
  $$\bigl\{\!\!\bigl\{ (e_1(x), \ldots, e_m(x)) : x \in G,\, s(x) = 1 \bigr\}\!\!\bigr\} = \bigl\{\!\!\bigl\{ (\hat{e}_1(x), \ldots, \hat{e}_m(x)) : x \in G,\, \hat{s}(x) = 1 \bigr\}\!\!\bigr\},$$
  where $\{\!\!\{\cdot\}\!\!\}$ denotes a multiset. That is, the selected rows form the same multiset (equality up to reordering).

- **Connection** (Copy Constraint): Given expressions $e_1, \ldots, e_m$ and a permutation $\sigma: G \to G$, a connection argument asserts that for all $x \in G$:
  $$e_i(x) = e_j(\sigma(x))$$
  for specified pairs $(i, j)$. This enforces that certain cells across (potentially different) columns contain identical values.

- **Lookup**: Given expressions $(s, e_1, \ldots, e_m)$ and a table $(t_1, \ldots, t_m)$ (either fixed or defined by expressions with selector $\hat{s}$), a lookup argument asserts that for all $x \in G$ with $s(x) = 1$:
  $$(e_1(x), \ldots, e_m(x)) \in \bigl\{ (t_1(y), \ldots, t_m(y)) : y \in G,\, \hat{s}(y) = 1 \bigr\}.$$
  That is, every selected row in the source appears (at least once) in the table.

- **Range Check**: Given expressions $s,e$ and bounds $a, b \in \mathbb{Z}$ with $a \leq b$, a range check argument asserts that for all $x \in G$ with $s(x) = 1$:
  $$e(x) \in [a, b].$$
  This is typically implemented as a special case of a lookup into a precomputed range table $[a, b]$.
  
The complete list of arguments and variations can be found in the [PIL2 STD Lib](https://github.com/0xPolygonHermez/pil2-proofman/tree/main/pil2-components/lib/std/pil).
  
## Reduction to Sumcheck

Each component (AIR) in ZisK can have multiple arguments. All arguments within a component are reduced to a single univariate sumcheck via the [LogUp](https://eprint.iacr.org/2022/1530) protocol. For example, a range check is reduced by checking that:
$$
\sum_{x \in G} \frac{s(x)}{e(x) + \alpha} = \sum_{x \in G} \frac{m(x)}{r(x) + \alpha},
$$
where $r(g^i) = a + i - 1$ for $i \in [1, b - a + 1]$, and $r(g^i) = b$ for $i > b - a + 1$. Here, $m$ counts the multiplicity of each value in the range $[a, b]$ (i.e., how many times it was looked up).

### Batching Vectors of Expressions

When an argument involves a vector of expressions $(e_1, e_2, \ldots, e_k)$ rather than a single expression, we use a **random linear combination (RLC)** to batch them into a single value. Given a random challenge $\gamma$, we compute:
$$
\hat{e}(X) := \sum_{i=1}^{k} \gamma^{i-1} \cdot e_i(X)
$$
This reduces a lookup over $k$-tuples to a lookup over single field elements, preserving soundness with high probability over the random choice of $\gamma$.

### Preventing Cross-Argument Cancellation

A critical question arises: how do we prevent terms from multiple, presumably independent, arguments from canceling each other? If such cancellation were possible, a malicious prover could construct a valid overall sumcheck even when individual arguments are incorrect.

To address this, we introduce a **unique identifier (UID)** for each argument. Each argument $\mathcal{A}$ is associated with a unique identifier $\text{uid}$, a known field element that is incorporated into the sumcheck via a RLC.

Following with the range check example, we transform the input expressions as:
$$
\hat{e}(X) := e(X) \cdot \gamma + \text{uid}_e, \qquad \hat{r}(X) := r(X) \cdot \gamma + \text{uid}_r
$$

The sumcheck reduction is then applied to $\hat{e}$ and $\hat{r}$ instead of the original expressions.

For arguments involving vectors of expressions $(e_1, e_2, \ldots, e_k)$, the UID is incorporated into the same RLC used for batching:
$$
\hat{e}(X) := \text{uid}_e + \sum_{i=1}^{k} \gamma^i \cdot e_i(X)
$$

By placing the UID as the constant term, we ensure that each argument's contribution to the sumcheck is tagged with its unique identifier, preventing malicious cancellation across independent arguments.

## Cross-Component Consistency

Recall that ZisK arithmetizes a complete computing system as a collection of independent components. Each component is defined by its own AIR, and consistency between components is enforced via shared arguments.

For example, the CPU component processes the sequence of instructions in a program. When it executes a memory operation, it "requests" the result from the memory component via a lookup argument. The CPU commits to the input/output tuple of the operation, and the memory component must later prove that this tuple corresponds to a valid memory access. The complete list of ZisK components can be found [here](https://github.com/0xPolygonHermez/zisk/blob/main/pil/zisk.pil).

### Partial Sumchecks Across Components

A consequence of this modular design is that arguments with the same UID can be invoked from different arithmetization components. Therefore, a single component might not be able to certify the full sumcheck between the input expressions of an argument:
$$
\sum_{x \in G} \frac{s(x)}{e(x) + \alpha} = \sum_{x \in G} \frac{m(x)}{r(x) + \alpha}
$$

Instead, each component proves the result of a **partial sum**:
$$
\sum_{x \in G} \frac{s(x)}{e(x) + \alpha} = c
$$

where $c$ is the field element that the prover claims as the result of the partial summation over the subgroup $G$ corresponding to component.

### Aggregating Partial Sums via Proof Composition

ZisK uses **proof aggregation** to combine these partial results into a complete verification. The process works as follows:

1. **Leaf proofs**: Each arithmetization component independently generates a proof that includes its partial sum $c$ as a public output.

2. **Aggregation tree**: These leaf proofs are combined in a tree structure. At each level, an aggregation circuit:
   - Verifies the child proofs
   - Adds together the partial sums: $c_{\text{parent}} = c_{\text{left}} + c_{\text{right}}$
   - Outputs the accumulated sum for the next level

3. **Root verification**: At the top of the aggregation tree, the final accumulated sums are checked to satisfy the original sumcheck equation. The verifier checks:
   $$
   \sum_i c_i^{(\text{send})} = \sum_j c_j^{(\text{receive})}
   $$
   where $c_i^{(\text{send})}$ are the partial sums from components sending values (e.g., the CPU requesting memory operations) and $c_j^{(\text{receive})}$ are the partial sums from components receiving values (e.g., the memory component fulfilling those requests).

This hierarchical aggregation ensures that even though individual components only prove local consistency, the global correctness of all cross-component interactions is verified at the root level, without requiring any single componente to handle the entire computation.

## Appendix

### The Degree Dilemma

Once all arguments within a component have been reduced via RLC, a **grand-sum polynomial** $S \in \mathbb{F}^{<N}[X]$ is constructed to satisfy for all $x \in G$:
$$
\begin{aligned}
S(x) &= S(g^{-1} \cdot x) \cdot (1 - L_1(x)) + \sum_{i=1}^k \frac{s_i(x)}{\hat{e}_i(x) + \alpha}, \\[0.3cm]
0 &= L_N(x) \cdot (S(x) - c)
\end{aligned}
$$
where $L_1, L_N$ are the Lagrange basis polynomials at $g$ and $g^N$, respectively, and $c$ is a known field element. 

The problem is that the first constraint has unbounded degree due to the sum of rational expressions, and every proving system imposes a bound on the constraint degree.

### Intermediate Polynomials

ZisK resolves this by introducing  **intermediate polynomials** that decompose the sum of rational expressions into bounded-degree pieces. Given the previous sum, we generate intermediate polynomials $\text{im}_1, \ldots, \text{im}_t$ such that:
$$
\sum_{i=1}^k \frac{s_i(x)}{\hat{e}_i(x) + \alpha} = \sum_{j=1}^t \text{im}_j(x)
$$

Each $\text{im}_j$ aggregates a subset of terms. Let $I_1, \ldots, I_t$ be a partition of $\{1, \ldots, k\}$. Depending on which form yields a lower-degree constraint, each intermediate is defined either as:
$$
\text{im}_j(x) = \sum_{i \in I_j} \frac{s_i(x)}{\hat{e}_i(x) + \alpha}
$$
or in inverse form:
$$
\frac{1}{\text{im}_j(x)} = \sum_{i \in I_j} \frac{s_i(x)}{\hat{e}_i(x) + \alpha}
$$

The partition is chosen so that all resulting constraints respect the degree bound. More details can be found in the [PIL Standard Library](https://github.com/0xPolygonHermez/pil2-proofman/blob/main/pil2-components/lib/std/pil/std_sum.pil#L295).

### Complete Constraint Set

With intermediate polynomials, the complete set of constraints becomes:
$$
\begin{aligned}
&\textbf{Intermediate definitions:} \\[0.2cm]
&\quad \text{im}_j(x) \cdot \prod_{i \in I_j} (\hat{e}_i(x) + \alpha) = \sum_{i \in I_j} s_i(x) \cdot \prod_{\substack{\ell \in I_j \\ \ell \neq i}} (\hat{e}_\ell(x) + \alpha), \quad \forall j \in [t] \\[0.4cm]
&\textbf{Grand-sum recurrence:} \\[0.2cm]
&\quad S(x) = S(g^{-1} \cdot x) \cdot (1 - L_1(x)) + \sum_{j=1}^t \text{im}_j(x) \\[0.4cm]
&\textbf{Boundary constraint:} \\[0.2cm]
&\quad 0 = L_N(x) \cdot (S(x) - c)
\end{aligned}
$$

The key insight is that by clearing denominators in the intermediate definitions, each constraint becomes a polynomial identity of bounded degree. The partition $I_1, \ldots, I_t$ is chosen such that:

$$
\deg\left( \prod_{i \in I_j} (\hat{e}_i(x) + \alpha) \right) \leq D_{\max}
$$

where $D_{\max}$ is the maximum allowable constraint degree in the proving system. This transforms the original unbounded-degree rational constraint into a collection of bounded-degree polynomial constraints.
