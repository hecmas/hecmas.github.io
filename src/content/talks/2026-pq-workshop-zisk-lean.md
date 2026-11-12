---
title: ZisK Recursion in Lean 4
date: 2026-10-10
event: 2nd Annual Post-Quantum Research Workshop (Ethereum)
eventUrl: https://pq.ethereum.org/cambridge/
location: Cambridge, UK
youtube: BGoyF3ENHqU
slides: https://docs.google.com/presentation/d/1IwMU-3E9WNGIJ7Y5iyT1DJcYIFi7FX36wPrRIIuC3UA/edit
abstract: >-
  ZisK proves unbounded executions with continuations: each chip's trace is split into segments that are proven
  separately and then recursively aggregated into a single final proof. This talk lays out a Lean 4 roadmap for
  formally verifying that recursion. It states the soundness theorem the final proof must imply (every proof in the
  tree verifies, the tree is well formed, and the buses balance), specifies the STARK verifier in Lean, proves the
  recursive verifier circuits sound against it, and works toward generating the entire proving setup from Lean.
---
