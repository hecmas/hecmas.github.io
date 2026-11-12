---
title: fflonK for the Polygon zkEVM
date: 2023-04-04
event: zkSummit 9
eventUrl: https://www.zksummit.com/
location: Lisbon, Portugal
youtube: yPC8Eiyo5P4
slides: /uploads/2023-fflonk-in-zkevm.pdf
abstract: >-
  PlonK is a zk-SNARK that is currently being widely adopted as the underlying proving system in numerous projects not
  only because it possesses a small proof size and verification time, but also because it does not require a specific
  trusted setup. fflonK is a variant of PlonK that offers significantly improved verifier performance, albeit at the
  cost of roughly tripling the prover time. fflonK achieves this through the use of a variant of the KZG polynomial
  commitment scheme that reduces the opening of multiple polynomials at a single point to the opening of a single
  polynomial at multiple points via an "FFT-like" construction.


  However, the increased prover time of fflonK is not a significant concern in the context of the zkEVM, as the size
  of the circuit that fflonK is being applied to is relatively small thanks to a series of reductions via proof
  composition of a STARK-based proving system (our eSTARK). Furthermore, we have made slight modifications to fflonK to
  ensure a faster prover and gave the option of turning it zero-knowledge in a PlonK-style manner.
---
