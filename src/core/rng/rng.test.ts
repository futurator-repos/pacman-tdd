import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createRng } from './rng.ts';

/**
 * Frightened ghosts choose their turns pseudo-randomly. That is the only
 * randomness in the game rules, and it is injected rather than ambient so a
 * failing game can be replayed exactly from its seed.
 *
 * These tests are what make that guarantee real.
 */
describe('createRng', () => {
  describe('determinism', () => {
    it('produces an identical sequence for the same seed', () => {
      const a = createRng(12345);
      const b = createRng(12345);

      const fromA = Array.from({ length: 100 }, () => a.next());
      const fromB = Array.from({ length: 100 }, () => b.next());

      expect(fromA).toEqual(fromB);
    });

    it('produces a different sequence for a different seed', () => {
      const a = createRng(1);
      const b = createRng(2);

      const fromA = Array.from({ length: 50 }, () => a.next());
      const fromB = Array.from({ length: 50 }, () => b.next());

      expect(fromA).not.toEqual(fromB);
    });

    it('replays the same sequence for any seed', () => {
      fc.assert(
        fc.property(fc.integer(), (seed) => {
          const first = Array.from({ length: 20 }, () => createRng(seed).next());
          const second = Array.from({ length: 20 }, () => createRng(seed).next());
          expect(first).toEqual(second);
        }),
      );
    });
  });

  describe('next', () => {
    it('returns values within [0, 1)', () => {
      const rng = createRng(999);
      expect.assertions(1000);
      for (let i = 0; i < 500; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('does not immediately repeat itself', () => {
      const rng = createRng(7);
      const values = new Set(Array.from({ length: 200 }, () => rng.next()));
      /* A generator stuck on one value would still satisfy the range test
         above. This is what catches it. */
      expect(values.size).toBeGreaterThan(190);
    });
  });

  describe('nextInt', () => {
    it('returns integers within [0, maxExclusive)', () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, max) => {
          const value = createRng(seed).nextInt(max);
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(max);
        }),
      );
    });

    it('always returns 0 when the range is 1', () => {
      const rng = createRng(42);
      expect.assertions(20);
      for (let i = 0; i < 20; i++) {
        expect(rng.nextInt(1)).toBe(0);
      }
    });

    it('reaches every value in a small range', () => {
      const rng = createRng(2024);
      const seen = new Set<number>();
      for (let i = 0; i < 400; i++) {
        seen.add(rng.nextInt(4));
      }
      /* Ghost turn choice picks between up to four directions. A generator
         that never returned 3 would bias movement in a way no range check
         would notice. */
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    });

    it('rejects a non-positive range rather than returning nonsense', () => {
      const rng = createRng(1);
      expect(() => rng.nextInt(0)).toThrow(/positive/i);
      expect(() => rng.nextInt(-5)).toThrow(/positive/i);
    });
  });

  describe('independence from ambient state', () => {
    it('is unaffected by how many other generators exist', () => {
      const control = Array.from({ length: 10 }, () => createRng(5).next());

      const noise = createRng(99);
      for (let i = 0; i < 100; i++) noise.next();

      const after = Array.from({ length: 10 }, () => createRng(5).next());
      expect(after).toEqual(control);
    });
  });
});
