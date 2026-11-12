---
title: Linkable Attribute-Based Signature
authors: [me]
date: 2020-10-01
venue: "Master's thesis, Polytechnic University of Catalonia (UPC). Advisors: M. Paz Morillo Bosch and Ramiro Martínez Pinilla"
type: thesis
award: Honorable Mention, Premio Leonardo Torres Quevedo 2020 en Criptología y Seguridad de la Información
abstract: >-
  Attribute-based signatures, as introduced by Maji et al. [MPR11] allow to generate anonymously a signature for a
  message on behalf of a signing policy. To sign a message, a private attribute that satisfies the signing policy has
  to be used. It is furthermore not possible to identify the actual signer based on the signature. Attribute-based
  signatures have some important properties for electronic voting, e.g., it guarantees that a vote has been submitted
  by an eligible voter without revealing her identity. To be fully applicable in that setting, attribute-based
  signatures must allow not only to determine when some signatures have been emitted by the same person, but also it
  has to easily detect when the signatures have been issued by different persons. In this thesis, we solve the
  aforementioned problems by constructing a linkable attribute-based signature (LABS) scheme for unbounded circuits in
  the random oracle model. We start by providing a generic construction of LABS schemes, where we define both the
  linkability and exculpability properties. We also provide a concrete instantiation of our generic LABS construction
  from protocols based on lattices. We do it by introducing a new zero-knowledge proof of knowledge for proving
  possession of a valid signature of the lattice-based signature scheme of Boschini et al. [Bos+20].
links:
  - { label: UPCommons, url: "https://hdl.handle.net/2117/332721" }
  - { label: PDF, url: "/uploads/TFM.pdf" }
bibtex: |-
  @mastersthesis{MasipArdevol2020LABS,
    title  = {Linkable Attribute-based Signature},
    author = {Masip Ard{\'e}vol, H{\'e}ctor},
    school = {Universitat Polit{\`e}cnica de Catalunya},
    year   = {2020},
    month  = oct,
    url    = {https://hdl.handle.net/2117/332721}
  }
---
