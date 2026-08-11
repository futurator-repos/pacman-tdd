import type { GhostTargeter } from './target-context.ts';

/* STUB — slice s05 RED phase. Signature only, no behaviour. The origin tile is
   the inert value; every test fixture deliberately sits away from {0,0} so no
   correct expectation can ever be satisfied by this stub. */
export const blinkyTarget: GhostTargeter = () => ({ col: 0, row: 0 });
