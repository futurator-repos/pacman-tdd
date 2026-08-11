import type { GhostTargeter } from './target-context.ts';

/* STUB — slice s05 RED phase. Signature only, no behaviour. Every fixture in
   pinky.test.ts sits away from the origin, so this inert value cannot make a
   single assertion pass that ought to be failing. */
export const pinkyTarget: GhostTargeter = () => ({ col: 0, row: 0 });
