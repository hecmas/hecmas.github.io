// A tiny CTF for curious visitors: 2-of-2 XOR secret sharing.
//   share1 is hidden in an HTML comment on every page; share2 is printed in the browser console.
//   share1 ⊕ share2 = "flag{n0t_3v3ry_s1gn4l_1s_c0n57r41n3d} -> /witness-7f3a"
// To change the flag: pick a random pad of the same length, share1 = pad, share2 = flag ⊕ pad.
export const ctf = {
  share1: 'd720d72078dffccec9aded5378a5da1c498b6424ac81f18da90081e51cc5f6a422f31a72a7b01a076cc4425c340daacda9c6a69bbeb6',
  share2: 'b14cb64703b1ccba969e9b600adc856f78ec0a10c0dec0fef663b18b29f28490139d2916da9037394ceb35354063cfbedaeb91fd8dd7',
  secretPath: '/witness-7f3a',
};
