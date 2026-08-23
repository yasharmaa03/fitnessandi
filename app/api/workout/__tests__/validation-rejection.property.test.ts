// Feature: workout-tracking, Property 5: Validation Rejection Completeness
// Validates: Requirements 3.4, 3.5, 9.9

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateSetInput } from '@/lib/types/workout';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid base set input (all IDs and set_number are always valid here). */
const validBaseFields = {
  workout_log_id: 'log-valid-id',
  exercise_id: 'exercise-valid-id',
  set_number: 1,
};

/**
 * Arbitrary for weight values strictly below 0 (invalid lower bound).
 * fc.double produces values like -0.001, -500, -9999, etc.
 */
const weightBelowMinArb = fc.double({ min: -1e6, max: -Number.EPSILON, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for weight values strictly above 9999 (invalid upper bound).
 * We use 9999.01 as the minimum to avoid floating-point precision issues where
 * 9999 + Number.EPSILON rounds back to 9999 in IEEE 754 representation.
 */
const weightAboveMaxArb = fc.double({ min: 9999.01, max: 1e7, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for reps values strictly below 1 (invalid lower bound).
 * Reps must be integers; 0 and below are invalid.
 */
const repsBelowMinArb = fc.integer({ min: -10000, max: 0 });

/**
 * Arbitrary for reps values strictly above 999 (invalid upper bound).
 */
const repsAboveMaxArb = fc.integer({ min: 1000, max: 100000 });

/**
 * Arbitrary for RPE values strictly below 1 (invalid lower bound).
 * Uses small negative floats and zero.
 */
const rpeBelowMinArb = fc.double({ min: -100, max: 1 - Number.EPSILON, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for RPE values strictly above 10 (invalid upper bound).
 */
const rpeAboveMaxArb = fc.double({ min: 10 + Number.EPSILON, max: 1000, noNaN: true, noDefaultInfinity: true });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 5: Validation Rejection Completeness', () => {

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds weight (< 0) is rejected with a weight-related error',
    () => {
      fc.assert(
        fc.property(weightBelowMinArb, (weight) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: weight,
            reps: 10,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('weight');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds weight (> 9999) is rejected with a weight-related error',
    () => {
      fc.assert(
        fc.property(weightAboveMaxArb, (weight) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: weight,
            reps: 10,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('weight');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds reps (< 1) is rejected with a reps-related error',
    () => {
      fc.assert(
        fc.property(repsBelowMinArb, (reps) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: 100,
            reps,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('reps');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds reps (> 999) is rejected with a reps-related error',
    () => {
      fc.assert(
        fc.property(repsAboveMaxArb, (reps) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: 100,
            reps,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('reps');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds RPE (< 1) is rejected with an rpe-related error',
    () => {
      fc.assert(
        fc.property(rpeBelowMinArb, (rpe) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: 100,
            reps: 10,
            rpe,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('rpe');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Feature: workout-tracking, Property 5: Out-of-bounds RPE (> 10) is rejected with an rpe-related error',
    () => {
      fc.assert(
        fc.property(rpeAboveMaxArb, (rpe) => {
          const result = validateSetInput({
            ...validBaseFields,
            weight_kg: 100,
            reps: 10,
            rpe,
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.toLowerCase()).toContain('rpe');
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Example-based sanity checks
// ---------------------------------------------------------------------------

describe('Property 5 — example-based sanity checks', () => {

  // Weight bounds
  it('rejects weight_kg = -0.01 (just below 0)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: -0.01, reps: 10 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/weight/i);
  });

  it('rejects weight_kg = -1000', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: -1000, reps: 10 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/weight/i);
  });

  it('rejects weight_kg = 9999.01 (just above 9999)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 9999.01, reps: 10 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/weight/i);
  });

  it('rejects weight_kg = 10000', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 10000, reps: 10 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/weight/i);
  });

  // Reps bounds
  it('rejects reps = 0 (just below 1)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reps/i);
  });

  it('rejects reps = -5', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: -5 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reps/i);
  });

  it('rejects reps = 1000 (just above 999)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 1000 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reps/i);
  });

  // RPE bounds
  it('rejects rpe = 0.9 (just below 1)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 0.9 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/rpe/i);
  });

  it('rejects rpe = 0', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/rpe/i);
  });

  it('rejects rpe = 10.1 (just above 10)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 10.1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/rpe/i);
  });

  it('rejects rpe = 11', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 11 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/rpe/i);
  });

  // Boundary values that ARE valid (no rejection)
  it('accepts weight_kg = 0 (lower bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 0, reps: 1 });
    expect(result.valid).toBe(true);
  });

  it('accepts weight_kg = 9999 (upper bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 9999, reps: 1 });
    expect(result.valid).toBe(true);
  });

  it('accepts reps = 1 (lower bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 1 });
    expect(result.valid).toBe(true);
  });

  it('accepts reps = 999 (upper bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 999 });
    expect(result.valid).toBe(true);
  });

  it('accepts rpe = 1 (lower bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 1 });
    expect(result.valid).toBe(true);
  });

  it('accepts rpe = 10 (upper bound)', () => {
    const result = validateSetInput({ ...validBaseFields, weight_kg: 100, reps: 10, rpe: 10 });
    expect(result.valid).toBe(true);
  });
});
