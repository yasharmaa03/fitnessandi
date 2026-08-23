# Validation Functions Usage Examples

This document provides examples of how to use the validation functions in API routes and other code.

## validateWorkoutPlanInput

Use this function to validate workout plan creation requests:

```typescript
import { validateWorkoutPlanInput } from '@/lib/types/workout';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate input
  const validation = validateWorkoutPlanInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }
  
  // Proceed with creating the workout plan...
}
```

## validateSessionInput

Use this function to validate workout session creation requests:

```typescript
import { validateSessionInput } from '@/lib/types/workout';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate input
  const validation = validateSessionInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }
  
  // Proceed with creating the workout session...
}
```

## validateSetInput

Use this function to validate set logging requests:

```typescript
import { validateSetInput } from '@/lib/types/workout';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate input
  const validation = validateSetInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }
  
  // Proceed with logging the set...
}
```

## Error Handling

All validation functions return a `ValidationResult` object:

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}
```

- If `valid` is `true`, the input passed all validation checks
- If `valid` is `false`, the `error` field contains a descriptive message explaining what failed

## Validation Rules

### WorkoutPlanInput
- `user_id`: required, non-empty string
- `name`: required, 1-200 characters
- `description`: optional, max 1000 characters
- `exercises`: required, array with at least one exercise
  - `exercise_id`: required, non-empty string
  - `target_sets`: required, 1-10
  - `target_reps`: required, 1-999
  - `rest_seconds`: required, 0-600
  - `order_index`: required, >= 0

### SessionInput
- `user_id`: required, non-empty string
- `plan_id`: required, non-empty string
- `date`: required, YYYY-MM-DD format
- `notes`: optional, string

### SetInput
- `workout_log_id`: required, non-empty string
- `exercise_id`: required, non-empty string
- `set_number`: required, positive integer
- `weight_kg`: required, 0-9999, max 2 decimal places
- `reps`: required, 1-999
- `rpe`: optional, 1-10, max 1 decimal place
