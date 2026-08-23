// Feature: workout-tracking — Property-based tests for calculation utilities
// Validates: Requirements 5.3, 5.4, 6.6, 6.7, 7.5, 17.1, 17.2, 17.3

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeOneRepMax,
  calculateVolume,
  calculateProgressiveOverload,
} from '@/lib/workout/calculations';

// ---------------------------------------------------------------------------
// Property 1: Epley Formula Monotonicity
// Validates: Requirements 5.4, 17.1
// ---------------------------------------------------------------------------

describe('Property 1: Epley Formula Monotonicity', () => {
  it(
    'Feature: workout-tracking, Property 1: 1RM increases strictly with weight when reps are held constant',
    () => {
      fc.assert(
        fc.property(
          // Two distinct positive weights with w1 < w2
          fc.tuple(
            fc.double({ min: 0.5, max: 499.5, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: 0.5, max: 499.5, noNaN: true, noDefaultInfinity: true }),
          ),
          fc.integer({ min: 1, max: 10 }),
          ([w1Raw, w2Raw], reps) => {
            // Ensure w1 !== w2 and establish order
            fc.pre(Math.abs(w1Raw - w2Raw) > 0.01);
            const w1 = Math.min(w1Raw, w2Raw);
            const w2 = Math.max(w1Raw, w2Raw);
            fc.pre(w1 > 0 && w2 > w1);

            const orm1 = computeOneRepMax(w1, reps);
            const orm2 = computeOneRepMax(w2, reps);

            expect(orm2).toBeGreaterThan(orm1);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 1: 1RM increases strictly with reps when weight is held constant',
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true }),
          // Two distinct rep counts r1 < r2 within [1, 10]
          fc.tuple(
            fc.integer({ min: 1, max: 9 }),
            fc.integer({ min: 1, max: 10 }),
          ),
          (weight, [r1Raw, r2Raw]) => {
            fc.pre(weight > 0);
            fc.pre(r1Raw !== r2Raw);
            const r1 = Math.min(r1Raw, r2Raw);
            const r2 = Math.max(r1Raw, r2Raw);
            fc.pre(r2 > r1);

            const orm1 = computeOneRepMax(weight, r1);
            const orm2 = computeOneRepMax(weight, r2);

            expect(orm2).toBeGreaterThan(orm1);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 2: Volume Calculation Commutativity
// Validates: Requirements 5.3, 17.3
// ---------------------------------------------------------------------------

describe('Property 2: Volume Calculation Commutativity', () => {
  it(
    'Feature: workout-tracking, Property 2: volume([s1, s2]) === volume([s2, s1]) for any two sets',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            weight: fc.double({ min: 0, max: 9999, noNaN: true, noDefaultInfinity: true }),
            reps: fc.integer({ min: 1, max: 999 }),
          }),
          fc.record({
            weight: fc.double({ min: 0, max: 9999, noNaN: true, noDefaultInfinity: true }),
            reps: fc.integer({ min: 1, max: 999 }),
          }),
          (s1, s2) => {
            const volumeForward = calculateVolume([s1, s2]);
            const volumeReversed = calculateVolume([s2, s1]);

            expect(volumeForward).toBeCloseTo(volumeReversed, 10);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 3: Progressive Overload Weight Cap
// Validates: Requirements 6.6, 7.5, 17.2
// ---------------------------------------------------------------------------

describe('Property 3: Progressive Overload Weight Cap', () => {
  it(
    'Feature: workout-tracking, Property 3: suggested weight never exceeds 110% of previous weight',
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 200, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 1, max: 10, noNaN: true, noDefaultInfinity: true }),
          (prevWeight, rpe) => {
            const suggested = calculateProgressiveOverload(prevWeight, rpe);
            const cap = prevWeight * 1.1;

            // Allow a tiny floating-point epsilon above the cap (rounding to 0.5 kg
            // could push the result up by at most 0.25 kg, which is < 0.5 kg slack)
            expect(suggested).toBeLessThanOrEqual(cap + 0.25);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 4: RPE-Based Weight Adjustment Bounds
// Validates: Requirements 6.6, 6.7, 17.2
// ---------------------------------------------------------------------------

describe('Property 4: RPE-Based Weight Adjustment Bounds', () => {
  it(
    'Feature: workout-tracking, Property 4: RPE in [1, 7.9] suggests weight between prevWeight*1.025 and prevWeight*1.05 (with rounding tolerance)',
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 200, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 1, max: 7.9, noNaN: true, noDefaultInfinity: true }),
          (prevWeight, rpe) => {
            const suggested = calculateProgressiveOverload(prevWeight, rpe);

            // The unrounded result falls within [prevWeight*1.025, prevWeight*1.05].
            // After rounding to nearest 0.5 kg the result can drift at most 0.25 kg
            // from any boundary, so we add/subtract 0.25 as the tolerance.
            const lowerBound = prevWeight * 1.025 - 0.25;
            const upperBound = prevWeight * 1.05 + 0.25;

            expect(suggested).toBeGreaterThanOrEqual(lowerBound);
            expect(suggested).toBeLessThanOrEqual(upperBound);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 4: RPE in (9, 10] suggests weight ≤ prevWeight (maintain or decrease)',
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 200, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 9.1, max: 10, noNaN: true, noDefaultInfinity: true }),
          (prevWeight, rpe) => {
            const suggested = calculateProgressiveOverload(prevWeight, rpe);

            // Rounding to 0.5 kg can push the result up by at most 0.25 kg, so we
            // allow a 0.25 kg tolerance above prevWeight.
            expect(suggested).toBeLessThanOrEqual(prevWeight + 0.25);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
