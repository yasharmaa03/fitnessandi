/**
 * Integration test for seed-exercises script
 * Tests the complete workflow with sample data
 * 
 * Validates requirements: 11.1, 11.2, 11.3, 11.4, 11.8, 11.9, 11.10
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  transformExercise,
  isValidExercise,
} from '../seed-exercises';

describe('Exercise Seed Script - Integration Test', () => {
  it('should process sample dataset correctly', () => {
    // Load sample exercises
    const samplePath = join(__dirname, 'sample-exercises.json');
    const rawData = readFileSync(samplePath, 'utf-8');
    const exercises = JSON.parse(rawData);

    // Track statistics similar to the actual seed script
    let totalProcessed = 0;
    let validCount = 0;
    let invalidCount = 0;
    const seenNames = new Set<string>();
    let duplicateCount = 0;
    const transformed = [];

    // Process each exercise
    for (const exercise of exercises) {
      totalProcessed++;

      // Check if valid
      if (!isValidExercise(exercise)) {
        invalidCount++;
        continue;
      }

      // Check for duplicates (case-insensitive)
      const nameLower = exercise.name.toLowerCase();
      if (seenNames.has(nameLower)) {
        duplicateCount++;
        continue;
      }

      seenNames.add(nameLower);
      validCount++;
      transformed.push(transformExercise(exercise));
    }

    // Validate statistics (Requirement 11.9)
    expect(totalProcessed).toBe(8); // Total exercises in sample
    expect(validCount).toBe(6); // Valid exercises after validation and deduplication
    expect(invalidCount).toBe(1); // 1 invalid exercise (missing instructions)
    expect(duplicateCount).toBe(1); // 1 duplicate (BARBELL BENCH PRESS)

    // Validate transformations (Requirement 11.3)
    const benchPress = transformed.find(e => e.name === 'Barbell Bench Press');
    expect(benchPress).toBeDefined();
    expect(benchPress?.muscle_group).toBe('chest');
    expect(benchPress?.equipment).toBe('barbell');
    expect(benchPress?.instructions).toContain('Lie flat on a bench');
    expect(benchPress?.media_url).toBe('https://example.com/bench-press.jpg');

    // Validate defaults (Requirements 11.6, 11.7)
    const plank = transformed.find(e => e.name === 'Plank');
    expect(plank).toBeDefined();
    expect(plank?.muscle_group).toBe('full_body'); // Unknown category defaults to full_body
    expect(plank?.equipment).toBe('bodyweight'); // Missing equipment defaults to bodyweight

    // Validate category mapping (Requirement 11.5)
    const curl = transformed.find(e => e.name === 'Dumbbell Curl');
    expect(curl).toBeDefined();
    expect(curl?.muscle_group).toBe('arms'); // 'biceps' maps to 'arms'

    // Validate equipment mapping
    const pullup = transformed.find(e => e.name === 'Pull-up');
    expect(pullup).toBeDefined();
    expect(pullup?.equipment).toBe('bodyweight'); // 'body weight' maps to 'bodyweight'

    // Validate case-insensitive deduplication (Requirement 11.4)
    // The duplicate 'BARBELL BENCH PRESS' should have been skipped
    const allNames = transformed.map(e => e.name.toLowerCase());
    const uniqueNames = new Set(allNames);
    expect(allNames.length).toBe(uniqueNames.size); // No duplicates in output
    expect(allNames.filter(n => n === 'barbell bench press').length).toBe(1);
  });

  it('should handle all muscle group mappings correctly', () => {
    const testExercises = [
      { name: 'E1', category: 'chest', instructions: ['x'] },
      { name: 'E2', category: 'back', instructions: ['x'] },
      { name: 'E3', category: 'legs', instructions: ['x'] },
      { name: 'E4', category: 'shoulders', instructions: ['x'] },
      { name: 'E5', category: 'biceps', instructions: ['x'] },
      { name: 'E6', category: 'core', instructions: ['x'] },
      { name: 'E7', category: 'unknown', instructions: ['x'] },
    ];

    const transformed = testExercises.map(transformExercise);

    expect(transformed[0].muscle_group).toBe('chest');
    expect(transformed[1].muscle_group).toBe('back');
    expect(transformed[2].muscle_group).toBe('legs');
    expect(transformed[3].muscle_group).toBe('shoulders');
    expect(transformed[4].muscle_group).toBe('arms'); // biceps → arms
    expect(transformed[5].muscle_group).toBe('core');
    expect(transformed[6].muscle_group).toBe('full_body'); // unknown → full_body
  });

  it('should handle all equipment mappings correctly', () => {
    const testExercises = [
      { name: 'E1', equipment: 'barbell', instructions: ['x'] },
      { name: 'E2', equipment: 'dumbbell', instructions: ['x'] },
      { name: 'E3', equipment: 'machine', instructions: ['x'] },
      { name: 'E4', equipment: 'cable', instructions: ['x'] },
      { name: 'E5', equipment: 'bodyweight', instructions: ['x'] },
      { name: 'E6', equipment: 'resistance band', instructions: ['x'] },
      { name: 'E7', equipment: 'none', instructions: ['x'] },
      { name: 'E8', instructions: ['x'] }, // missing equipment
    ];

    const transformed = testExercises.map(transformExercise);

    expect(transformed[0].equipment).toBe('barbell');
    expect(transformed[1].equipment).toBe('dumbbell');
    expect(transformed[2].equipment).toBe('machine');
    expect(transformed[3].equipment).toBe('cable');
    expect(transformed[4].equipment).toBe('bodyweight');
    expect(transformed[5].equipment).toBe('resistance_band');
    expect(transformed[6].equipment).toBe('none');
    expect(transformed[7].equipment).toBe('bodyweight'); // missing → bodyweight
  });

  it('should validate performance requirement (Requirement 11.2)', () => {
    // Generate 1000 exercises
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      name: `Exercise ${i}`,
      category: 'chest',
      equipment: 'barbell',
      instructions: ['Step 1', 'Step 2', 'Step 3'],
    }));

    const startTime = Date.now();

    // Process all exercises
    const seenNames = new Set<string>();
    const transformed = [];

    for (const exercise of largeDataset) {
      if (isValidExercise(exercise)) {
        const nameLower = exercise.name.toLowerCase();
        if (!seenNames.has(nameLower)) {
          seenNames.add(nameLower);
          transformed.push(transformExercise(exercise));
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    // Should complete processing 1000 exercises well under 60 seconds
    // (excluding database operations)
    expect(duration).toBeLessThan(1); // Should be very fast for just transformation
    expect(transformed.length).toBe(1000);
  });
});
