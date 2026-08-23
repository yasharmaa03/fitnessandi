/**
 * Unit tests for exercise seed script transformation logic
 * Validates requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */

import { describe, it, expect } from 'vitest';
import {
  transformExercise,
  mapCategory,
  mapEquipment,
  isValidExercise,
} from '../seed-exercises';

describe('Exercise Seed Script - Transformation Logic', () => {
  describe('mapCategory', () => {
    it('should map chest category correctly', () => {
      expect(mapCategory('chest')).toBe('chest');
      expect(mapCategory('Chest')).toBe('chest');
      expect(mapCategory('CHEST')).toBe('chest');
      expect(mapCategory('pectorals')).toBe('chest');
    });

    it('should map back category correctly', () => {
      expect(mapCategory('back')).toBe('back');
      expect(mapCategory('lats')).toBe('back');
      expect(mapCategory('lower back')).toBe('back');
    });

    it('should map legs category correctly', () => {
      expect(mapCategory('legs')).toBe('legs');
      expect(mapCategory('quadriceps')).toBe('legs');
      expect(mapCategory('hamstrings')).toBe('legs');
      expect(mapCategory('glutes')).toBe('legs');
    });

    it('should map shoulders category correctly', () => {
      expect(mapCategory('shoulders')).toBe('shoulders');
      expect(mapCategory('delts')).toBe('shoulders');
    });

    it('should map arms category correctly', () => {
      expect(mapCategory('arms')).toBe('arms');
      expect(mapCategory('biceps')).toBe('arms');
      expect(mapCategory('triceps')).toBe('arms');
    });

    it('should map core category correctly', () => {
      expect(mapCategory('core')).toBe('core');
      expect(mapCategory('abdominals')).toBe('core');
      expect(mapCategory('abs')).toBe('core');
    });

    it('should default to full_body for unmapped categories (Requirement 11.6)', () => {
      expect(mapCategory('unknown category')).toBe('full_body');
      expect(mapCategory('cardio')).toBe('full_body');
      expect(mapCategory('olympic')).toBe('full_body');
      expect(mapCategory(undefined)).toBe('full_body');
    });

    it('should handle case-insensitive matching (Requirement 11.5)', () => {
      expect(mapCategory('BICEPS')).toBe('arms');
      expect(mapCategory('BiCePs')).toBe('arms');
      expect(mapCategory('  shoulders  ')).toBe('shoulders');
    });
  });

  describe('mapEquipment', () => {
    it('should map barbell equipment correctly', () => {
      expect(mapEquipment('barbell')).toBe('barbell');
      expect(mapEquipment('Barbell')).toBe('barbell');
    });

    it('should map dumbbell equipment correctly', () => {
      expect(mapEquipment('dumbbell')).toBe('dumbbell');
      expect(mapEquipment('dumbbells')).toBe('dumbbell');
    });

    it('should map bodyweight equipment correctly', () => {
      expect(mapEquipment('bodyweight')).toBe('bodyweight');
      expect(mapEquipment('body weight')).toBe('bodyweight');
      expect(mapEquipment('body only')).toBe('bodyweight');
    });

    it('should map machine equipment correctly', () => {
      expect(mapEquipment('machine')).toBe('machine');
    });

    it('should map cable equipment correctly', () => {
      expect(mapEquipment('cable')).toBe('cable');
      expect(mapEquipment('cables')).toBe('cable');
    });

    it('should map resistance band equipment correctly', () => {
      expect(mapEquipment('resistance band')).toBe('resistance_band');
      expect(mapEquipment('bands')).toBe('resistance_band');
    });

    it('should default to bodyweight for missing equipment (Requirement 11.7)', () => {
      expect(mapEquipment(undefined)).toBe('bodyweight');
      expect(mapEquipment('')).toBe('bodyweight');
    });

    it('should default to bodyweight for unmapped equipment', () => {
      expect(mapEquipment('unknown equipment')).toBe('bodyweight');
    });
  });

  describe('isValidExercise', () => {
    it('should accept valid exercise with all required fields (Requirement 11.8)', () => {
      const valid = {
        name: 'Bench Press',
        instructions: ['Lie on bench', 'Lower bar to chest', 'Press up'],
      };
      expect(isValidExercise(valid)).toBe(true);
    });

    it('should reject exercise without name (Requirement 11.8)', () => {
      const noName = {
        instructions: ['Step 1', 'Step 2'],
      };
      expect(isValidExercise(noName)).toBe(false);
    });

    it('should reject exercise with empty name (Requirement 11.8)', () => {
      const emptyName = {
        name: '   ',
        instructions: ['Step 1'],
      };
      expect(isValidExercise(emptyName)).toBe(false);
    });

    it('should reject exercise without instructions (Requirement 11.8)', () => {
      const noInstructions = {
        name: 'Squat',
      };
      expect(isValidExercise(noInstructions)).toBe(false);
    });

    it('should reject exercise with empty instructions array (Requirement 11.8)', () => {
      const emptyInstructions = {
        name: 'Squat',
        instructions: [],
      };
      expect(isValidExercise(emptyInstructions)).toBe(false);
    });

    it('should reject exercise with empty instructions string (Requirement 11.8)', () => {
      const emptyInstructions = {
        name: 'Squat',
        instructions: '   ',
      };
      expect(isValidExercise(emptyInstructions)).toBe(false);
    });
  });

  describe('transformExercise', () => {
    it('should transform complete exercise correctly (Requirement 11.3)', () => {
      const raw = {
        name: 'Barbell Bench Press',
        category: 'chest',
        equipment: 'barbell',
        instructions: ['Lie on bench', 'Grip bar shoulder-width', 'Lower to chest', 'Press up'],
        images: ['https://example.com/bench-press.jpg'],
      };

      const result = transformExercise(raw);

      expect(result.name).toBe('Barbell Bench Press');
      expect(result.muscle_group).toBe('chest');
      expect(result.equipment).toBe('barbell');
      expect(result.instructions).toBe('Lie on bench, Grip bar shoulder-width, Lower to chest, Press up');
      expect(result.media_url).toBe('https://example.com/bench-press.jpg');
    });

    it('should handle missing optional fields with defaults (Requirements 11.6, 11.7)', () => {
      const raw = {
        name: 'Push-up',
        instructions: ['Get in plank position', 'Lower body', 'Push back up'],
      };

      const result = transformExercise(raw);

      expect(result.name).toBe('Push-up');
      expect(result.muscle_group).toBe('full_body'); // Default per 11.6
      expect(result.equipment).toBe('bodyweight'); // Default per 11.7
      expect(result.instructions).toBe('Get in plank position, Lower body, Push back up');
      expect(result.media_url).toBe(null);
    });

    it('should convert instructions array to comma-separated text (Requirement 11.3)', () => {
      const raw = {
        name: 'Squat',
        instructions: ['Stand with feet shoulder-width', 'Lower hips', 'Return to standing'],
      };

      const result = transformExercise(raw);
      expect(result.instructions).toBe('Stand with feet shoulder-width, Lower hips, Return to standing');
    });

    it('should truncate long instructions to 5000 characters', () => {
      const longInstruction = 'A'.repeat(6000);
      const raw = {
        name: 'Complex Exercise',
        instructions: [longInstruction],
      };

      const result = transformExercise(raw);
      expect(result.instructions?.length).toBeLessThanOrEqual(5000);
      expect(result.instructions).toMatch(/\.\.\.$/);
    });

    it('should truncate long names to 200 characters', () => {
      const longName = 'A'.repeat(300);
      const raw = {
        name: longName,
        instructions: ['Step 1'],
      };

      const result = transformExercise(raw);
      expect(result.name.length).toBeLessThanOrEqual(200);
    });

    it('should truncate long media URLs to 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(3000);
      const raw = {
        name: 'Exercise',
        instructions: ['Step 1'],
        images: [longUrl],
      };

      const result = transformExercise(raw);
      expect(result.media_url?.length).toBeLessThanOrEqual(2048);
    });

    it('should only accept valid HTTP/HTTPS URLs for media', () => {
      const invalidUrls = [
        { name: 'Ex1', instructions: ['S1'], images: ['ftp://example.com/img.jpg'] },
        { name: 'Ex2', instructions: ['S1'], images: ['/local/path.jpg'] },
        { name: 'Ex3', instructions: ['S1'], images: ['not-a-url'] },
      ];

      for (const raw of invalidUrls) {
        const result = transformExercise(raw);
        expect(result.media_url).toBe(null);
      }

      const validUrl = {
        name: 'Ex4',
        instructions: ['S1'],
        images: ['https://example.com/valid.jpg'],
      };
      const validResult = transformExercise(validUrl);
      expect(validResult.media_url).toBe('https://example.com/valid.jpg');
    });

    it('should trim whitespace from names', () => {
      const raw = {
        name: '  Deadlift  ',
        instructions: ['Step 1'],
      };

      const result = transformExercise(raw);
      expect(result.name).toBe('Deadlift');
    });

    it('should map various category formats correctly (Requirement 11.5)', () => {
      const testCases = [
        { category: 'biceps', expected: 'arms' },
        { category: 'triceps', expected: 'arms' },
        { category: 'quadriceps', expected: 'legs' },
        { category: 'hamstrings', expected: 'legs' },
        { category: 'abdominals', expected: 'core' },
        { category: 'lower back', expected: 'back' },
        { category: 'delts', expected: 'shoulders' },
        { category: 'unknown', expected: 'full_body' },
      ];

      for (const { category, expected } of testCases) {
        const raw = {
          name: 'Test Exercise',
          category,
          instructions: ['Step 1'],
        };
        const result = transformExercise(raw);
        expect(result.muscle_group).toBe(expected);
      }
    });
  });
});
