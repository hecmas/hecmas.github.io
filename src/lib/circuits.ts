// Levels for the "Break my circuit" homepage puzzle.
// Every signal lives in F_97, so all arithmetic is mod P.

export const P = 97;
export const mod = (a: number) => ((a % P) + P) % P;

export type Values = Record<string, number>;

export interface Constraint {
  id: string;
  /** How the constraint is shown in the checklist. */
  text: string;
  lhs: (v: Values) => number;
  rhs: (v: Values) => number;
}

export interface CodeLine {
  text: string;
  /** Constraint this line enforces (for live status colouring). */
  cid?: string;
  /** Line removed by the "bug". Shown commented out until the circuit is patched. */
  missing?: boolean;
}

export interface Signal {
  name: string;
  label: string;
  value: number;
}

export interface Level {
  id: string;
  tab: string;
  goal: string;
  code: CodeLine[];
  publics: Signal[];
  witness: Signal[];
  constraints: Constraint[];
  /** Constraints the bug removed; enforced only after patching. */
  missing: Constraint[];
  /** Fills intermediate signals from the inputs (warm-up only). */
  honest?: (v: Values) => Values;
  win: string;
  patched?: string;
}

const eq = (id: string, text: string, lhs: Constraint['lhs'], rhs: Constraint['rhs']): Constraint => ({
  id,
  text,
  lhs,
  rhs,
});

export const levels: Level[] = [
  {
    id: 'cubic',
    tab: 'Warm-up',
    goal: 'Prove you know a secret x with x³ + x + 5 = 35. Fill in the witness and submit it.',
    code: [
      { text: 'template Cubic() {' },
      { text: '    signal input x;       // private: only you know it' },
      { text: '    signal output y;      // public: 35' },
      { text: '    signal x2 <== x * x;', cid: 'c1' },
      { text: '    signal x3 <== x2 * x;', cid: 'c2' },
      { text: '    y <== x3 + x + 5;', cid: 'c3' },
      { text: '}' },
    ],
    publics: [{ name: 'y', label: 'y', value: 35 }],
    witness: [
      { name: 'x', label: 'x', value: 0 },
      { name: 'x2', label: 'x2', value: 0 },
      { name: 'x3', label: 'x3', value: 0 },
    ],
    constraints: [
      eq('c1', 'x2 === x * x', (v) => v.x2, (v) => v.x * v.x),
      eq('c2', 'x3 === x2 * x', (v) => v.x3, (v) => v.x2 * v.x),
      eq('c3', 'y === x3 + x + 5', (v) => v.y, (v) => v.x3 + v.x + 5),
    ],
    missing: [],
    honest: (v) => ({ x2: mod(v.x * v.x), x3: mod(v.x * v.x * v.x) }),
    win: 'The verifier is convinced you know such an x, and learned nothing about it. (Mod 97, x = 3, 18 and 76 all work.) That was the honest way. Now let’s cheat.',
  },
  {
    id: 'iszero',
    tab: 'IsZero',
    goal: 'The public claim is in = 7, out = 1, i.e. “7 is zero”. Find a witness the verifier accepts.',
    code: [
      { text: 'template IsZero() {' },
      { text: '    signal input in;' },
      { text: '    signal output out;' },
      { text: '    signal inv;' },
      { text: '    inv <-- in != 0 ? 1 / in : 0;   // a hint, not a constraint' },
      { text: '    out <== -in * inv + 1;', cid: 'c1' },
      { text: '    in * out === 0;', cid: 'm1', missing: true },
      { text: '}' },
    ],
    publics: [
      { name: 'in', label: 'in', value: 7 },
      { name: 'out', label: 'out', value: 1 },
    ],
    witness: [{ name: 'inv', label: 'inv', value: 14 }],
    constraints: [eq('c1', 'out === -in * inv + 1', (v) => v.out, (v) => -v.in * v.inv + 1)],
    missing: [eq('m1', 'in * out === 0', (v) => v.in * v.out, () => 0)],
    win: '7 is zero. 🙃 The <-- line only assigns a value; it constrains nothing, so you were free to pick inv = 0. The one constraint that would have caught you was deleted.',
    patched: 'With in * out === 0 restored, out = 1 forces in = 0. Your forged witness is rejected, and so is every other one.',
  },
  {
    id: 'range',
    tab: 'Range check',
    goal: 'This circuit should prove that in fits in 2 bits (in < 4). Convince the verifier that 9 does.',
    code: [
      { text: 'template RangeCheck2() {   // in < 4' },
      { text: '    signal input in;' },
      { text: '    signal bits[2];' },
      { text: '    bits[0] * (bits[0] - 1) === 0;', cid: 'm1', missing: true },
      { text: '    bits[1] * (bits[1] - 1) === 0;', cid: 'm2', missing: true },
      { text: '    bits[0] + 2 * bits[1] === in;', cid: 'c1' },
      { text: '}' },
    ],
    publics: [{ name: 'in', label: 'in', value: 9 }],
    witness: [
      { name: 'b0', label: 'bits[0]', value: 1 },
      { name: 'b1', label: 'bits[1]', value: 0 },
    ],
    constraints: [eq('c1', 'bits[0] + 2 * bits[1] === in', (v) => v.b0 + 2 * v.b1, (v) => v.in)],
    missing: [
      eq('m1', 'bits[0] * (bits[0] - 1) === 0', (v) => v.b0 * (v.b0 - 1), () => 0),
      eq('m2', 'bits[1] * (bits[1] - 1) === 0', (v) => v.b1 * (v.b1 - 1), () => 0),
    ],
    win: '9 < 4. Nothing forces the “bits” to be 0 or 1, so any field element goes, and 1 + 2·4 = 9 sails through.',
    patched: 'With the booleanity constraints back, each bit must be 0 or 1, so in can only be 0, 1, 2 or 3. Your witness is rejected.',
  },
];

export function check(c: Constraint, v: Values) {
  const lhs = mod(c.lhs(v));
  const rhs = mod(c.rhs(v));
  return { lhs, rhs, ok: lhs === rhs };
}
