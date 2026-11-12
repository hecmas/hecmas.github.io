---
title: "eSTARK: Extending STARKs with Arguments"
authors: [me, Marc Guzmán Albiol, Jordi Baylina Melé, Jose Luis Muñoz Tapia]
date: 2024-11-01
venue: Designs, Codes and Cryptography 92(11)
type: journal
featured: true
abstract: >-
  STARK is a widely used transparent proof system that uses low-degree tests for proving the correctness of a
  computer program. STARK consumes an intermediate representation known as AIR that is more appropriate for programs
  with a relatively short and structured description. However, an AIR is not able to succinctly express non-equality
  constraints, leading to the incorporation of unwanted polynomials. We present the eSTARK protocol, a new
  probabilistic proof that generalizes the STARK family through the introduction of a more generic intermediate
  representation called eAIR. We describe eSTARK in the polynomial IOP model, which combines the optimized version of
  the STARK protocol with the incorporation of three arguments into the protocol. We also explain various techniques
  that enhance the vanilla STARK complexity, including optimizations applied to polynomial computations, and analyze
  the tradeoffs between controlling the constraint degree either at the representation of the AIR or inside the
  eSTARK itself.
links:
  - { label: Journal, url: "https://link.springer.com/article/10.1007/s10623-024-01457-z" }
  - { label: ePrint, url: "https://eprint.iacr.org/2023/474" }
bibtex: |-
  @article{MasipArdevol2024eSTARK,
    title   = {eSTARK: extending STARKs with arguments},
    author  = {Masip-Ardevol, H{\'e}ctor and Guzm{\'a}n-Albiol, Marc and Baylina-Mel{\'e}, Jordi and Mu{\~n}oz-Tapia, Jose Luis},
    journal = {Designs, Codes and Cryptography},
    volume  = {92},
    number  = {11},
    pages   = {3677--3721},
    year    = {2024},
    doi     = {10.1007/s10623-024-01457-z}
  }
---
