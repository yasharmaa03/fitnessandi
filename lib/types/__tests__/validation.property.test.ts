import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateSetInput, validateWorkoutPlanInput, validateSessionInput } from '../workout';

describe('Property 5: Validation Rejection Completeness', () => {
  describe('**Validates: Requirements 3.4, 3.5, 9.9**', () => {
    it('rejects weight_kg values below 0', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -0.01, noNaN: true }), // Below minimum
          fc.integer({ min: 1, max: 999 }), // Valid reps
          fc.oneof(
            fc.constant(undefined),
            fc.double({ min: 1, max: 10, noNaN: true })
          ), // Valid or undefined RPE
          (weight, reps, rpe) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe,
            });
            
            return !result.valid && result.error !== undefined && result.error.includes('weight');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects weight_kg values above 9999', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 9999.01, max: 99999, noNaN: true }), // Above maximum
          fc.integer({ min: 1, max: 999 }), // Valid reps
          fc.oneof(
            fc.constant(undefined),
            fc.double({ min: 1, max: 10, noNaN: true })
          ), // Valid or undefined RPE
          (weight, reps, rpe) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe,
            });
            
            return !result.valid && result.error !== undefined && result.error.includes('weight');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects reps values below 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999.99, noNaN: true }), // Valid weight
          fc.integer({ max: 0 }), // Below minimum (0 or negative)
          (weight, reps) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe: undefined,
            });
            
            // Should be invalid when reps < 1
            return !result.valid && result.error !== undefined && result.error.includes('reps');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects reps values above 999', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999.99, noNaN: true }), // Valid weight
          fc.integer({ min: 1000 }), // Above maximum (1000 or more)
          (weight, reps) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe: undefined,
            });
            
            // Should be invalid when reps > 999
            return !result.valid && result.error !== undefined && result.error.includes('reps');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects RPE values below 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999.99, noNaN: true }), // Valid weight
          fc.integer({ min: 1, max: 999 }), // Valid reps
          fc.double({ max: 0.99, noNaN: true }), // Below minimum
          (weight, reps, rpe) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe,
            });
            
            return !result.valid && result.error !== undefined && result.error.includes('rpe');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects RPE values above 10', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999.99, noNaN: true }), // Valid weight
          fc.integer({ min: 1, max: 999 }), // Valid reps
          fc.double({ min: 10.01, max: 100, noNaN: true }), // Above maximum
          (weight, reps, rpe) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe,
            });
            
            return !result.valid && result.error !== undefined && result.error.includes('rpe');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects non-integer reps values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999.99, noNaN: true }), // Valid weight
          fc.double({ min: 1.01, max: 998.99, noNaN: true }).filter(x => !Number.isInteger(x)), // Non-integer
          fc.oneof(
            fc.constant(undefined),
            fc.double({ min: 1, max: 10, noNaN: true })
          ), // Valid or undefined RPE
          (weight, reps, rpe) => {
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: weight,
              reps,
              rpe,
            });
            
            return !result.valid && result.error !== undefined && result.error.includes('reps');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts valid weight, reps, and RPE within bounds', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 9999, noNaN: true }), // Valid weight
          fc.integer({ min: 1, max: 999 }), // Valid reps
          fc.oneof(
            fc.constant(undefined),
            fc.double({ min: 1, max: 10, noNaN: true })
          ), // Valid or undefined RPE
          (weight, reps, rpe) => {
            // Round weight to 2 decimal places to match validation
            const roundedWeight = Math.round(weight * 100) / 100;
            // Round RPE to 1 decimal place if defined
            const roundedRpe = rpe !== undefined ? Math.round(rpe * 10) / 10 : undefined;
            
            const result = validateSetInput({
              workout_log_id: 'test-id',
              exercise_id: 'test-id',
              set_number: 1,
              weight_kg: roundedWeight,
              reps,
              rpe: roundedRpe,
            });
            
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
