---
title: Fflonk for the Polygon zkEVM
date: '2023-04-04'

event_name: zkSummit 9
event_url: https://www.zksummit.com/

location: Lisbon
address:
  street: Rua da Junqueira 63
  city: Lisbon
  postcode: '1300-307'
  country: Portugal

summary: ''
abstract: |
  PlonK is a zk-SNARK that is currently being widely adopted as the underlying proving system in numerous projects not only because it possesses a small proof size and verification time, but also because it does not require a specific trusted setup. Fflonk is a variant of PlonK that offers significantly improved verifier performance, albeit at the cost of roughly tripling the prover time. Fflonk achieves this through the use of a variant of the KZG polynomial commitment scheme that reduces the opening of multiple polynomials at a single point to the opening of a single polynomial at multiple points via an "FFT-like" construction.

  However, the increased prover time of Fflonk is not a significant concern in the context of the zkEVM, as the size of the circuit that Fflonk is being applied to is relatively small thanks to a series of reductions via proof composition of a STARK-based proving system (our eSTARK). Furthermore, we have made slight modifications to Fflonk to ensure a faster prover and gave the option of turning it zero-knowledge in a PlonK-style manner.

event_start: '2023-04-04T00:00:00Z'
event_all_day: true

authors:
  - me

tags: []
featured: false

links:
  - icon: brands/youtube
    name: Presentation
    url: https://www.youtube.com/watch?v=yPC8Eiyo5P4
  - icon: book-open
    name: Slides
    url: uploads/fflonk.pdf
---