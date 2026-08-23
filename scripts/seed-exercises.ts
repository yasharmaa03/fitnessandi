/**
 * Exercise Library Seed Script
 * 
 * This script imports exercises from the free-exercise-db JSON dataset and seeds
 * the exercises table in Supabase.
 * 
 * Features:
 * - Reads from configurable file path or URL
 * - Transforms fields (category → muscle_group, instructions array → comma-separated)
 * - Deduplicates by case-insensitive name comparison
 * - Handles missing fields with defaults (bodyweight equipment, full_body muscle group)
 * - Validates required fields (name, instructions)
 * - Idempotent: skips exercises that already exist
 * - Completes within 60 seconds for datasets up to 1000 exercises
 * 
 * Requirements validated: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 * 
 * Usage:
 *   npx tsx scripts/seed-exercises.ts
 *   npx tsx scripts/seed-exercises.ts --source ./path/to/exercises.json
 *   npx tsx scripts/seed-exercises.ts --source https://example.com/exercises.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Configuration
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// Type Definitions
// ============================================================================

type MuscleGroup = 
  | 'chest' 
  | 'back' 
  | 'legs' 
  | 'shoulders' 
  | 'arms' 
  | 'core' 
  | 'full_body';

type Equipment = 
  | 'barbell' 
  | 'dumbbell' 
  | 'machine' 
  | 'cable' 
  | 'bodyweight' 
  | 'resistance_band' 
  | 'none';

interface RawExercise {
  name?: string;
  category?: string;
  equipment?: string;
  instructions?: string[];
  images?: string[];
  [key: string]: any;
}

interface TransformedExercise {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  media_url: string | null;
}

interface SeedSummary {
  totalProcessed: number;
  inserted: number;
  duplicatesSkipped: number;
  invalidSkipped: number;
  alreadyExisted: number;
}

// ============================================================================
// Category Mapping
// ============================================================================

/**
 * Maps exercise categories from free-exercise-db to standardized muscle_group values
 * Requirement 11.5: Exact string matching for category mapping
 */
const CATEGORY_TO_MUSCLE_GROUP: Record<string, MuscleGroup> = {
  // Chest variations
  'chest': 'chest',
  'pectorals': 'chest',
  
  // Back variations
  'back': 'back',
  'lats': 'back',
  'lower back': 'back',
  'middle back': 'back',
  'upper back': 'back',
  
  // Legs variations
  'legs': 'legs',
  'quadriceps': 'legs',
  'hamstrings': 'legs',
  'calves': 'legs',
  'glutes': 'legs',
  'thighs': 'legs',
  
  // Shoulders variations
  'shoulders': 'shoulders',
  'delts': 'shoulders',
  'deltoids': 'shoulders',
  
  // Arms variations
  'arms': 'arms',
  'biceps': 'arms',
  'triceps': 'arms',
  'forearms': 'arms',
  
  // Core variations
  'core': 'core',
  'abdominals': 'core',
  'abs': 'core',
  'obliques': 'core',
  
  // Full body
  'full body': 'full_body',
  'cardio': 'full_body',
  'olympic': 'full_body',
};

/**
 * Maps equipment names to standardized values
 */
const EQUIPMENT_MAPPING: Record<string, Equipment> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbell',
  'dumbbells': 'dumbbell',
  'machine': 'machine',
  'cable': 'cable',
  'cables': 'cable',
  'body weight': 'bodyweight',
  'bodyweight': 'bodyweight',
  'body only': 'bodyweight',
  'resistance band': 'resistance_band',
  'bands': 'resistance_band',
  'none': 'none',
  'other': 'none',
};

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Maps a category string to a standardized muscle_group
 * Requirement 11.5: Exact string matching
 * Requirement 11.6: Default to 'full_body' if no match
 */
function mapCategory(category: string | undefined): MuscleGroup {
  if (!category) {
    return 'full_body';
  }
  
  const normalized = category.toLowerCase().trim();
  return CATEGORY_TO_MUSCLE_GROUP[normalized] || 'full_body';
}

/**
 * Maps an equipment string to a standardized equipment value
 * Requirement 11.7: Default to 'bodyweight' if missing
 */
function mapEquipment(equipment: string | undefined): Equipment {
  if (!equipment) {
    return 'bodyweight';
  }
  
  const normalized = equipment.toLowerCase().trim();
  return EQUIPMENT_MAPPING[normalized] || 'bodyweight';
}

/**
 * Validates if an exercise has required fields
 * Requirement 11.8: Skip exercises lacking required fields (name or instructions)
 */
function isValidExercise(exercise: RawExercise): boolean {
  // Name is required and must not be empty
  if (!exercise.name || exercise.name.trim().length === 0) {
    return false;
  }
  
  // Instructions are required (either as array or string)
  if (!exercise.instructions || 
      (Array.isArray(exercise.instructions) && exercise.instructions.length === 0) ||
      (typeof exercise.instructions === 'string' && exercise.instructions.trim().length === 0)) {
    return false;
  }
  
  return true;
}

/**
 * Transforms a raw exercise from the dataset into the database format
 * Requirement 11.3: Transform fields with correct mappings
 */
function transformExercise(raw: RawExercise): TransformedExercise {
  // Convert instructions array to comma-separated text
  let instructions: string | null = null;
  if (raw.instructions) {
    if (Array.isArray(raw.instructions)) {
      instructions = raw.instructions.join(', ');
    } else if (typeof raw.instructions === 'string') {
      instructions = raw.instructions;
    }
  }
  
  // Truncate instructions if too long (max 5000 characters per schema)
  if (instructions && instructions.length > 5000) {
    instructions = instructions.substring(0, 4997) + '...';
  }
  
  // Extract media URL if available (prefer first image)
  let media_url: string | null = null;
  if (raw.images && Array.isArray(raw.images) && raw.images.length > 0) {
    const firstImage = raw.images[0];
    // Validate it's an HTTP/HTTPS URL
    if (typeof firstImage === 'string' && /^https?:\/\//.test(firstImage)) {
      media_url = firstImage.substring(0, 2048); // Truncate to max length
    }
  }
  
  // Truncate name if too long (max 200 characters per schema)
  let name = raw.name!.trim();
  if (name.length > 200) {
    name = name.substring(0, 200);
  }
  
  return {
    name,
    muscle_group: mapCategory(raw.category),
    equipment: mapEquipment(raw.equipment),
    instructions,
    media_url,
  };
}

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Loads exercises from a file path or URL
 * Requirement 11.1: Support configurable file path or URL
 */
async function loadExercises(source: string): Promise<RawExercise[]> {
  console.log(`📖 Loading exercises from: ${source}`);
  
  try {
    let data: string;
    
    // Check if source is a URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      console.log('   Fetching from URL...');
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      data = await response.text();
    } else {
      // Load from file
      console.log('   Reading from file...');
      data = readFileSync(source, 'utf-8');
    }
    
    const exercises = JSON.parse(data);
    
    // Handle both array and object with exercises array
    if (Array.isArray(exercises)) {
      return exercises;
    } else if (exercises.exercises && Array.isArray(exercises.exercises)) {
      return exercises.exercises;
    } else {
      throw new Error('Invalid JSON format: expected array or object with "exercises" array');
    }
  } catch (error: any) {
    console.error(`❌ Failed to load exercises: ${error.message}`);
    throw error;
  }
}

/**
 * Fetches existing exercise names from database for deduplication
 * Requirement 11.10: Check for existing exercise names (idempotent)
 */
async function fetchExistingExercises(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  console.log('🔍 Fetching existing exercises from database...');
  
  const { data, error } = await supabase
    .from('exercises')
    .select('name');
  
  if (error) {
    console.error(`❌ Error fetching existing exercises: ${error.message}`);
    throw error;
  }
  
  // Build a set of lowercase names for case-insensitive comparison
  const existingNames = new Set<string>();
  if (data) {
    for (const exercise of data) {
      existingNames.add(exercise.name.toLowerCase());
    }
  }
  
  console.log(`   Found ${existingNames.size} existing exercises`);
  return existingNames;
}

// ============================================================================
// Main Seeding Logic
// ============================================================================

/**
 * Seeds the exercises table with transformed and deduplicated data
 * Requirements: 11.2 (60s for 1000 exercises), 11.4 (deduplication), 11.9 (summary), 11.10 (idempotent)
 */
async function seedExercises(source: string): Promise<SeedSummary> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  
  console.log('🌱 Starting exercise library seed...\n');
  
  const summary: SeedSummary = {
    totalProcessed: 0,
    inserted: 0,
    duplicatesSkipped: 0,
    invalidSkipped: 0,
    alreadyExisted: 0,
  };
  
  try {
    // Load raw exercises
    const rawExercises = await loadExercises(source);
    console.log(`✅ Loaded ${rawExercises.length} exercises from source\n`);
    
    // Fetch existing exercises for idempotency check
    const existingExercises = await fetchExistingExercises(supabase);
    console.log('');
    
    // Process exercises
    console.log('⚙️  Processing exercises...');
    const seenNames = new Set<string>(); // For deduplication within the dataset
    const exercisesToInsert: TransformedExercise[] = [];
    
    for (const raw of rawExercises) {
      summary.totalProcessed++;
      
      // Requirement 11.8: Skip invalid exercises
      if (!isValidExercise(raw)) {
        summary.invalidSkipped++;
        continue;
      }
      
      const transformed = transformExercise(raw);
      const nameLower = transformed.name.toLowerCase();
      
      // Requirement 11.10: Skip if already exists in database
      if (existingExercises.has(nameLower)) {
        summary.alreadyExisted++;
        continue;
      }
      
      // Requirement 11.4: Deduplicate within dataset (case-insensitive, first occurrence)
      if (seenNames.has(nameLower)) {
        summary.duplicatesSkipped++;
        continue;
      }
      
      seenNames.add(nameLower);
      exercisesToInsert.push(transformed);
    }
    
    console.log(`   ✓ Validated: ${exercisesToInsert.length} exercises to insert`);
    console.log(`   ✓ Skipped: ${summary.invalidSkipped} invalid, ${summary.duplicatesSkipped} duplicates, ${summary.alreadyExisted} already existed\n`);
    
    // Insert exercises in batches for better performance
    if (exercisesToInsert.length > 0) {
      console.log('💾 Inserting exercises into database...');
      
      const BATCH_SIZE = 100;
      let inserted = 0;
      
      for (let i = 0; i < exercisesToInsert.length; i += BATCH_SIZE) {
        const batch = exercisesToInsert.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('exercises')
          .insert(batch);
        
        if (error) {
          console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}: ${error.message}`);
          // Continue with next batch instead of failing completely
          continue;
        }
        
        inserted += batch.length;
        console.log(`   ✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(exercisesToInsert.length / BATCH_SIZE)} (${inserted} exercises)`);
      }
      
      summary.inserted = inserted;
      console.log(`✅ Successfully inserted ${inserted} exercises\n`);
    } else {
      console.log('ℹ️  No new exercises to insert\n');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Requirement 11.9: Output summary
    console.log('═'.repeat(60));
    console.log('SEED SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total records processed:    ${summary.totalProcessed}`);
    console.log(`Exercises inserted:         ${summary.inserted}`);
    console.log(`Duplicates skipped:         ${summary.duplicatesSkipped}`);
    console.log(`Invalid records skipped:    ${summary.invalidSkipped}`);
    console.log(`Already existed in DB:      ${summary.alreadyExisted}`);
    console.log(`Duration:                   ${duration}s`);
    console.log('═'.repeat(60));
    
    // Requirement 11.2: Verify performance (60s for 1000 exercises)
    if (summary.totalProcessed >= 1000 && parseFloat(duration) > 60) {
      console.warn('\n⚠️  Warning: Processing took longer than 60 seconds for 1000+ exercises');
    }
    
    return summary;
    
  } catch (error: any) {
    console.error(`\n❌ Seed failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  console.log('🏋️  Exercise Library Seed Script');
  console.log('═'.repeat(60));
  console.log('');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let source = process.env.EXERCISE_DATASET_PATH || '';
  
  // Check for --source flag
  const sourceIndex = args.indexOf('--source');
  if (sourceIndex !== -1 && args[sourceIndex + 1]) {
    source = args[sourceIndex + 1];
  }
  
  // Default source (placeholder - user should provide actual path/URL)
  if (!source) {
    console.error('❌ No data source specified');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/seed-exercises.ts --source <path-or-url>');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/seed-exercises.ts --source ./data/exercises.json');
    console.error('  npx tsx scripts/seed-exercises.ts --source https://example.com/exercises.json');
    console.error('');
    console.error('Or set environment variable:');
    console.error('  export EXERCISE_DATASET_PATH=./data/exercises.json');
    console.error('');
    process.exit(1);
  }
  
  try {
    await seedExercises(source);
    console.log('\n✨ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed failed');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { seedExercises, transformExercise, mapCategory, mapEquipment, isValidExercise };
