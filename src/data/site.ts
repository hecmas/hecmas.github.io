// Everything about *you* lives here: profile, links, CV entries and selected work.
// Edit this file to update the homepage and the About page.

export const profile = {
  name: 'Héctor Masip Ardevol',
  shortName: 'Héctor Masip',
  role: 'Research Engineer',
  org: { name: 'ZisK', url: 'https://zisk.technology/' },
  tagline: 'I build systems that prove computation without revealing secrets.',
  description:
    'Research engineer working on zero-knowledge proofs. Currently building ZisK, a high-performance zkVM. Previously Polygon zkEVM (eSTARK, fflonK).',
  email: 'lecter1729@gmail.com',
  cv: '/uploads/resume.pdf',
};

export type SocialIcon = 'email' | 'github' | 'x' | 'scholar' | 'linkedin' | 'hackmd';

export const socials: { label: string; url: string; icon: SocialIcon }[] = [
  { label: 'GitHub', url: 'https://github.com/hecmas', icon: 'github' },
  { label: 'Google Scholar', url: 'https://scholar.google.co.uk/citations?user=WoocbSMAAAAJ&hl', icon: 'scholar' },
  { label: 'X', url: 'https://twitter.com/EllipticHector', icon: 'x' },
  { label: 'HackMD', url: 'https://hackmd.io/@Wimet', icon: 'hackmd' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/hector-masip-ardevol-1922b4188/', icon: 'linkedin' },
  { label: 'Email', url: 'mailto:lecter1729@gmail.com', icon: 'email' },
];

export const nav = [
  { label: 'Writing', href: '/writing/' },
  { label: 'Publications', href: '/publications/' },
  { label: 'Talks', href: '/talks/' },
  { label: 'About', href: '/about/' },
];

// "Selected work" on the homepage. Lead with what you built and what your part was.
export const work: {
  title: string;
  period: string;
  summary: string;
  tags: string[];
  links: { label: string; url: string }[];
}[] = [
  {
    title: 'ZisK zkVM',
    period: '2025 — now',
    summary:
      'Research engineer on ZisK, a high-performance zero-knowledge virtual machine for proving arbitrary programs.',
    tags: ['zkVM', 'STARKs', 'Rust'],
    links: [{ label: 'zisk.technology', url: 'https://zisk.technology/' }],
  },
  {
    title: 'eSTARK',
    period: '2023',
    summary:
      'Generalized STARKs with the eAIR intermediate representation and three built-in arguments. The core proving system of the Polygon zkEVM prover.',
    tags: ['STARKs', 'Arithmetization', 'Polynomial IOPs'],
    links: [
      { label: 'Paper', url: 'https://eprint.iacr.org/2023/474' },
      { label: 'DCC journal', url: 'https://doi.org/10.1007/s10623-024-01457-z' },
    ],
  },
  {
    title: 'fflonK in the Polygon zkEVM',
    period: '2023',
    summary:
      'A faster-prover variant of fflonK used as the final SNARK wrapper over recursive eSTARK proofs, making on-chain verification cheap.',
    tags: ['SNARKs', 'KZG', 'Recursion'],
    links: [
      { label: 'Talk', url: 'https://www.youtube.com/watch?v=yPC8Eiyo5P4' },
      { label: 'Slides', url: '/uploads/2023-fflonk-in-zkevm.pdf' },
    ],
  },
  {
    title: 'Lookup arguments: PlonKup & RapidUp',
    period: '2022',
    summary:
      'PlonKup integrates plookup into PlonK. RapidUp extends lookups across multiple domains with a selector-based permutation protocol.',
    tags: ['Lookups', 'PlonK'],
    links: [
      { label: 'PlonKup', url: 'https://eprint.iacr.org/2022/086' },
      { label: 'RapidUp', url: 'https://eprint.iacr.org/2022/1050' },
    ],
  },
];

export const experience = [
  {
    role: 'Research Engineer',
    org: 'ZisK',
    url: 'https://zisk.technology/',
    start: 'Jun 2025',
    end: 'Present',
    summary: 'Building a high-performance zkVM.',
  },
  {
    role: 'Research Engineer',
    org: 'Polygon Labs',
    url: 'https://polygon.technology/',
    start: 'May 2023',
    end: 'Jun 2025',
    summary:
      'Polygon zkEVM: arithmetization with the extended AIR (eAIR), and the integrity of the proving system, a composition of an inner eSTARK with an outer fflonK.',
  },
];

export const education = [
  {
    degree: 'Doctoral studies, Applied Cryptography',
    org: 'Polytechnic University of Catalonia (UPC)',
    url: 'https://entel.upc.edu/en',
    start: '2021',
    end: '2023',
    summary: 'Department of Network Engineering. Left the program before completing the degree.',
  },
  {
    degree: 'MSc, Advanced Mathematics and Mathematical Engineering',
    org: 'Polytechnic University of Catalonia (UPC)',
    url: 'https://mamme.masters.upc.edu/en/',
    start: '2019',
    end: '2020',
    summary: 'Thesis on linkable attribute-based signatures.',
    file: { label: 'Thesis (PDF)', url: '/uploads/TFM.pdf' },
  },
  {
    degree: 'BSc, Mathematics',
    org: 'University of Alicante',
    url: 'https://web.ua.es/en/grados/grado-en-matematicas/undergraduate-degree-in-mathematics.html',
    start: '2015',
    end: '2019',
    summary: 'Focus on discrete mathematics. Thesis on the subgraph isomorphism problem.',
    file: { label: 'Thesis (PDF)', url: '/uploads/TFG.pdf' },
  },
];

export const interests = ['Math', 'Probabilistic Proofs', 'Formal Methods', 'Distributed Systems'];

export const languages = [
  { name: 'Spanish', level: 'Native' },
  { name: 'Catalan', level: 'Native' },
  { name: 'English', level: 'Fluent' },
];
