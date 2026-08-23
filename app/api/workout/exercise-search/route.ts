import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ── Keyword maps ────────────────────────────────────────────────────────────

const MUSCLE_KEYWORDS: Record<string, string> = {
  chest: 'chest', pec: 'chest', pecs: 'chest', pectoral: 'chest',
  back: 'back', lat: 'back', lats: 'back', traps: 'back', trap: 'back',
  rhomboid: 'back', rhomboids: 'back',
  leg: 'legs', legs: 'legs', quad: 'legs', quads: 'legs', hamstring: 'legs',
  hamstrings: 'legs', glute: 'legs', glutes: 'legs', calf: 'legs', calves: 'legs',
  thigh: 'legs', thighs: 'legs',
  shoulder: 'shoulders', shoulders: 'shoulders', delt: 'shoulders', delts: 'shoulders',
  arm: 'arms', arms: 'arms', bicep: 'arms', biceps: 'arms', tricep: 'arms',
  triceps: 'arms', forearm: 'arms', forearms: 'arms',
  core: 'core', abs: 'core', ab: 'core', abdominal: 'core', oblique: 'core',
  obliques: 'core', stomach: 'core',
  'full body': 'full_body', fullbody: 'full_body', cardio: 'full_body',
  conditioning: 'full_body', hiit: 'full_body', aerobic: 'full_body',
};

const EQUIPMENT_KEYWORDS: Record<string, string> = {
  barbell: 'barbell', bar: 'barbell', bb: 'barbell',
  dumbbell: 'dumbbell', dumbbells: 'dumbbell', db: 'dumbbell', dbs: 'dumbbell',
  machine: 'machine', machines: 'machine',
  cable: 'cable', cables: 'cable', pulley: 'cable',
  bodyweight: 'bodyweight', bw: 'bodyweight', 'body weight': 'bodyweight',
  'no equipment': 'bodyweight', 'no gear': 'bodyweight',
  band: 'resistance_band', bands: 'resistance_band', resistance: 'resistance_band',
  none: 'none',
};

// Strength/type aliases that map to equipment or muscle filters
const TYPE_KEYWORDS: Record<string, { equipment?: string; muscle_group?: string }> = {
  strength: {},          // no filter — return everything (strength is default)
  compound: {},
  isolation: {},
  push: { muscle_group: 'chest' },    // rough alias
  pull: { muscle_group: 'back' },
  cardio: { muscle_group: 'full_body' },
  stretching: {},
};

/**
 * Parse a free-text query into structured filters + remaining name search.
 * Tokens that match a known keyword are extracted; the rest become the name search.
 */
function parseQuery(raw: string): {
  nameSearch: string;
  muscleGroup: string;
  equipment: string;
} {
  const tokens = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const usedIndices = new Set<number>();
  let muscleGroup = '';
  let equipment = '';

  // First pass — try 2-word combos (e.g. "full body", "body weight")
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (!muscleGroup && MUSCLE_KEYWORDS[pair]) {
      muscleGroup = MUSCLE_KEYWORDS[pair];
      usedIndices.add(i);
      usedIndices.add(i + 1);
    } else if (!equipment && EQUIPMENT_KEYWORDS[pair]) {
      equipment = EQUIPMENT_KEYWORDS[pair];
      usedIndices.add(i);
      usedIndices.add(i + 1);
    }
  }

  // Second pass — single tokens
  for (let i = 0; i < tokens.length; i++) {
    if (usedIndices.has(i)) continue;
    const t = tokens[i];

    if (!muscleGroup && MUSCLE_KEYWORDS[t]) {
      muscleGroup = MUSCLE_KEYWORDS[t];
      usedIndices.add(i);
    } else if (!equipment && EQUIPMENT_KEYWORDS[t]) {
      equipment = EQUIPMENT_KEYWORDS[t];
      usedIndices.add(i);
    } else if (TYPE_KEYWORDS[t] !== undefined) {
      const alias = TYPE_KEYWORDS[t];
      if (!muscleGroup && alias.muscle_group) muscleGroup = alias.muscle_group;
      if (!equipment && alias.equipment) equipment = alias.equipment;
      usedIndices.add(i);
    }
  }

  // Whatever's left is the name search
  const nameSearch = tokens
    .filter((_, i) => !usedIndices.has(i))
    .join(' ')
    .trim();

  return { nameSearch, muscleGroup, equipment };
}

/**
 * GET /api/workout/exercise-search
 *
 * Accepts either structured params or a single smart `q` param:
 *   ?q=chest dumbbell      → muscle_group=chest, equipment=dumbbell
 *   ?q=cable back          → muscle_group=back, equipment=cable
 *   ?q=bench press         → name ilike '%bench press%'
 *   ?q=legs barbell squat  → muscle_group=legs, equipment=barbell, name ilike '%squat%'
 *   ?q=cardio              → muscle_group=full_body
 *   ?muscle_group=chest&equipment=dumbbell  (explicit params still work)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get('q')?.trim() ?? '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 25, 50) : 25;

  // Allow explicit override params too (used by the chip filters)
  const explicitMuscle = searchParams.get('muscle_group')?.trim() ?? '';
  const explicitEquipment = searchParams.get('equipment')?.trim() ?? '';

  // Parse smart query
  const { nameSearch, muscleGroup: parsedMuscle, equipment: parsedEquipment } = parseQuery(rawQ);

  const muscleGroup = explicitMuscle || parsedMuscle;
  const equipment = explicitEquipment || parsedEquipment;
  const nameFilter = nameSearch;

  const supabase = createServerClient();

  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .order('name', { ascending: true })
    .limit(limit);

  if (nameFilter) {
    query = query.ilike('name', `%${nameFilter}%`);
  }
  if (muscleGroup) {
    query = query.eq('muscle_group', muscleGroup);
  }
  if (equipment) {
    query = query.eq('equipment', equipment);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error searching exercises:', error);
    return NextResponse.json({ error: 'Failed to search exercises' }, { status: 500 });
  }

  return NextResponse.json({
    exercises: data ?? [],
    // Return parsed filters so the UI can reflect what was understood
    parsed: { nameFilter, muscleGroup, equipment },
  });
}
