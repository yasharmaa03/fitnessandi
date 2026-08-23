"""
workout_server.py — Personalised workout recommendation service.

Generates weekly plans based on:
  - User profile (goal, weight, height, age, gender, activity level)
  - Past workout history (logged_sets, workout_logs via Supabase)
  - Progressive overload (Epley 1RM + RPE-based weight progression)
  - Nutrition profile (calorie target informs volume/intensity)

Endpoint: POST /workout/recommend  { user_id, date }
"""

import logging
import os
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Supabase config ────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Workout Recommendation Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ─────────────────────────────────────────────

class WorkoutRequest(BaseModel):
    user_id: str
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class Exercise(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_group: str
    target_sets: int
    target_reps: int
    suggested_weight_kg: float
    rest_seconds: int
    rationale: str


class PlanMetadata(BaseModel):
    total_exercises: int
    estimated_duration_minutes: int
    focus_areas: List[str]


class WorkoutResponse(BaseModel):
    workout_type: str
    recommended_exercises: List[Exercise]
    plan_metadata: PlanMetadata


# ══════════════════════════════════════════════════════════════════════════
# Supabase helpers
# ══════════════════════════════════════════════════════════════════════════

def _sb_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_user_profile(user_id: str) -> Optional[Dict]:
    """
    Pull the user's nutrition profile (goal, weight, height, age, gender,
    activity_level, target_calories) from Supabase.
    Falls back to None if not found.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = (
        f"{SUPABASE_URL}/rest/v1/nutrition_profiles"
        f"?user_id=eq.{user_id}&limit=1&select=*"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url, headers=_sb_headers())
            if r.status_code == 200:
                data = r.json()
                return data[0] if data else None
    except Exception as e:
        logger.warning(f"Could not fetch user profile: {e}")
    return None


async def fetch_recent_logged_sets(user_id: str, days_back: int = 28) -> List[Dict]:
    """
    Fetch all logged_sets for the user from the last `days_back` days.
    Joins with workout_logs (for date) and exercises (for name/muscle_group).
    Returns a flat list of set records.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).date().isoformat()

    # Step 1: get recent workout_log IDs
    logs_url = (
        f"{SUPABASE_URL}/rest/v1/workout_logs"
        f"?user_id=eq.{user_id}&date=gte.{cutoff}&select=id,date"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(logs_url, headers=_sb_headers())
            if r.status_code != 200 or not r.json():
                return []
            logs = r.json()

        log_ids = [l["id"] for l in logs]
        log_date_map = {l["id"]: l["date"] for l in logs}

        if not log_ids:
            return []

        # Step 2: fetch sets for those logs with exercise details
        ids_filter = ",".join(f'"{lid}"' for lid in log_ids)
        sets_url = (
            f"{SUPABASE_URL}/rest/v1/logged_sets"
            f"?workout_log_id=in.({','.join(log_ids)})"
            f"&select=id,workout_log_id,exercise_id,set_number,weight_kg,reps,rpe"
        )
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(sets_url, headers=_sb_headers())
            sets = r.json() if r.status_code == 200 else []

        if not sets:
            return []

        # Step 3: fetch exercise details for unique exercise_ids
        ex_ids = list({s["exercise_id"] for s in sets})
        ex_url = (
            f"{SUPABASE_URL}/rest/v1/exercises"
            f"?id=in.({','.join(ex_ids)})"
            f"&select=id,name,muscle_group,equipment"
        )
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(ex_url, headers=_sb_headers())
            exercises = r.json() if r.status_code == 200 else []

        ex_map = {e["id"]: e for e in exercises}

        # Merge
        enriched = []
        for s in sets:
            ex = ex_map.get(s["exercise_id"], {})
            enriched.append({
                **s,
                "date": log_date_map.get(s["workout_log_id"], ""),
                "exercise_name": ex.get("name", ""),
                "muscle_group": ex.get("muscle_group", "full_body"),
                "equipment": ex.get("equipment", "none"),
            })
        return enriched

    except Exception as e:
        logger.warning(f"Could not fetch logged sets: {e}")
    return []


async def fetch_exercises_by_muscle(muscle_group: str, limit: int = 10) -> List[Dict]:
    """Pull real exercises from the DB for a given muscle group."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    url = (
        f"{SUPABASE_URL}/rest/v1/exercises"
        f"?muscle_group=eq.{muscle_group}&limit={limit}"
        f"&select=id,name,muscle_group,equipment"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url, headers=_sb_headers())
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.warning(f"Could not fetch exercises for {muscle_group}: {e}")
    return []


# ══════════════════════════════════════════════════════════════════════════
# Progressive overload logic (mirrors lib/workout/calculations.ts)
# ══════════════════════════════════════════════════════════════════════════

def epley_1rm(weight: float, reps: int) -> float:
    """Epley formula: 1RM = weight * (1 + reps/30)"""
    if weight <= 0 or reps < 1:
        return 0.0
    return weight * (1 + reps / 30)


def progressive_overload_weight(prev_weight: float, avg_rpe: Optional[float]) -> float:
    """
    RPE-based progressive overload (mirrors calculateProgressiveOverload in TS).
    If no RPE recorded, assume moderate effort (RPE 7 → +2.5%).
    """
    if prev_weight <= 0:
        return prev_weight
    rpe = avg_rpe if avg_rpe is not None else 7.0

    if rpe <= 6:
        suggested = prev_weight * 1.05
    elif rpe < 8:
        suggested = prev_weight * 1.025
    elif rpe <= 9:
        suggested = prev_weight
    else:
        suggested = prev_weight * 0.975

    # Hard cap: +10%
    suggested = min(suggested, prev_weight * 1.10)
    # Round to nearest 0.5 kg
    return round(suggested * 2) / 2


def round_to_half(val: float) -> float:
    return round(val * 2) / 2


# ══════════════════════════════════════════════════════════════════════════
# Base weight estimation from user profile
# ══════════════════════════════════════════════════════════════════════════

def estimate_base_weight(
    exercise_name: str,
    muscle_group: str,
    equipment: str,
    weight_kg: float,
    level: str,   # 'beginner' | 'intermediate' | 'advanced'
) -> float:
    """
    Estimate a starting weight based on bodyweight and experience level.
    Uses rough % of bodyweight ratios per muscle group as starting points.
    """
    bw = weight_kg or 70.0

    # % of bodyweight ratios for common movements
    ratios: Dict[str, Dict[str, float]] = {
        "beginner":     {"chest": 0.5, "back": 0.55, "legs": 0.75, "shoulders": 0.25, "arms": 0.2,  "core": 0.0, "full_body": 0.0},
        "intermediate": {"chest": 0.8, "back": 0.9,  "legs": 1.2,  "shoulders": 0.4,  "arms": 0.3,  "core": 0.0, "full_body": 0.0},
        "advanced":     {"chest": 1.1, "back": 1.3,  "legs": 1.6,  "shoulders": 0.6,  "arms": 0.45, "core": 0.0, "full_body": 0.0},
    }

    lvl = level.lower() if level else "intermediate"
    if lvl not in ratios:
        lvl = "intermediate"

    ratio = ratios[lvl].get(muscle_group, 0.5)

    if equipment in ("bodyweight", "none") or ratio == 0.0:
        return 0.0

    return round_to_half(bw * ratio)


# ══════════════════════════════════════════════════════════════════════════
# Per-exercise history lookup
# ══════════════════════════════════════════════════════════════════════════

def get_last_performance(exercise_id: str, sets: List[Dict]) -> Optional[Dict]:
    """
    From all logged sets, find the most recent set for a given exercise_id.
    Returns { weight_kg, reps, avg_rpe } or None.
    """
    matching = [s for s in sets if s.get("exercise_id") == exercise_id]
    if not matching:
        return None
    # Sort by date desc, then set_number desc
    matching.sort(key=lambda s: (s.get("date", ""), s.get("set_number", 0)), reverse=True)
    last = matching[0]

    # Average RPE across all sets in the last session for this exercise
    last_date = last.get("date", "")
    session_sets = [s for s in matching if s.get("date", "") == last_date]
    rpes = [s["rpe"] for s in session_sets if s.get("rpe") is not None]
    avg_rpe = sum(rpes) / len(rpes) if rpes else None

    return {
        "weight_kg": last["weight_kg"],
        "reps": last["reps"],
        "avg_rpe": avg_rpe,
    }


# ══════════════════════════════════════════════════════════════════════════
# Goal-aware volume / intensity tuning
# ══════════════════════════════════════════════════════════════════════════

def goal_params(goal: str, target_calories: int) -> Dict:
    """
    Return sets/reps/rest targets based on the user's primary goal.
    Also adjusts based on calorie deficit/surplus as a proxy for
    recovery capacity.
    """
    g = (goal or "").lower()
    # Calorie context: low calories → lower volume to avoid overtraining
    low_cal = target_calories > 0 and target_calories < 1800

    if "lose" in g or "loss" in g or "cut" in g:
        return {
            "sets": 3,
            "reps": 12 if not low_cal else 10,
            "rest": 60,
            "intensity_label": "moderate weight, higher reps for caloric burn",
        }
    elif "gain" in g or "muscle" in g or "bulk" in g or "hypertrophy" in g:
        return {
            "sets": 4,
            "reps": 8,
            "rest": 120,
            "intensity_label": "heavier load, lower reps for hypertrophy",
        }
    elif "strength" in g or "power" in g:
        return {
            "sets": 5,
            "reps": 5,
            "rest": 180,
            "intensity_label": "heavy load, low reps for strength",
        }
    else:
        # maintain / general fitness
        return {
            "sets": 3,
            "reps": 10,
            "rest": 90,
            "intensity_label": "balanced volume and intensity",
        }


# ══════════════════════════════════════════════════════════════════════════
# Training split based on goal + frequency
# ══════════════════════════════════════════════════════════════════════════

SPLITS = {
    # PPL — good for intermediate/advanced, gain/strength
    "ppl": {
        0: {"type": "push",  "muscles": ["chest", "shoulders"], "name": "Push"},
        1: {"type": "pull",  "muscles": ["back", "arms"],       "name": "Pull"},
        2: {"type": "legs",  "muscles": ["legs"],               "name": "Legs"},
        3: {"type": "push",  "muscles": ["chest", "shoulders"], "name": "Push"},
        4: {"type": "pull",  "muscles": ["back", "arms"],       "name": "Pull"},
        5: {"type": "legs",  "muscles": ["legs"],               "name": "Legs"},
        6: {"type": "rest",  "muscles": [],                     "name": "Rest"},
    },
    # Upper/Lower — good for weight loss / moderate
    "upper_lower": {
        0: {"type": "upper", "muscles": ["chest", "back", "shoulders", "arms"], "name": "Upper"},
        1: {"type": "lower", "muscles": ["legs", "core"],                       "name": "Lower"},
        2: {"type": "rest",  "muscles": [],                                     "name": "Rest"},
        3: {"type": "upper", "muscles": ["chest", "back", "shoulders", "arms"], "name": "Upper"},
        4: {"type": "lower", "muscles": ["legs", "core"],                       "name": "Lower"},
        5: {"type": "cardio","muscles": ["full_body"],                          "name": "Cardio"},
        6: {"type": "rest",  "muscles": [],                                     "name": "Rest"},
    },
    # Full body — good for beginners
    "full_body": {
        0: {"type": "full",  "muscles": ["chest", "back", "legs", "core"],     "name": "Full Body"},
        1: {"type": "rest",  "muscles": [],                                     "name": "Rest"},
        2: {"type": "full",  "muscles": ["shoulders", "arms", "legs", "core"], "name": "Full Body"},
        3: {"type": "rest",  "muscles": [],                                     "name": "Rest"},
        4: {"type": "full",  "muscles": ["chest", "back", "legs", "core"],     "name": "Full Body"},
        5: {"type": "cardio","muscles": ["full_body"],                          "name": "Cardio"},
        6: {"type": "rest",  "muscles": [],                                     "name": "Rest"},
    },
}


def choose_split(goal: str, level: str) -> str:
    g = (goal or "").lower()
    l = (level or "").lower()

    if l == "beginner":
        return "full_body"
    if "lose" in g or "loss" in g or "cut" in g:
        return "upper_lower"
    return "ppl"


# ══════════════════════════════════════════════════════════════════════════
# Core recommendation builder
# ══════════════════════════════════════════════════════════════════════════

async def build_day_recommendation(
    date_str: str,
    profile: Optional[Dict],
    logged_sets: List[Dict],
) -> Dict[str, Any]:
    """Build a single-day workout recommendation dict."""

    # ── defaults when no profile ──
    goal          = (profile or {}).get("goal", "maintain")
    weight_kg     = float((profile or {}).get("weight_kg", 70))
    level         = (profile or {}).get("level", "intermediate")   # from nutrition_profiles if present
    target_cal    = int((profile or {}).get("target_calories", 2000))
    activity      = (profile or {}).get("activity_level", "moderately_active")

    # Infer level from activity if not stored directly
    if level == "intermediate" and activity in ("sedentary", "lightly_active"):
        level = "beginner"
    elif activity in ("very_active", "extra_active"):
        level = "advanced"

    split_name = choose_split(goal, level)
    split = SPLITS[split_name]

    day_of_week = datetime.strptime(date_str, "%Y-%m-%d").weekday()
    day_plan = split[day_of_week]
    workout_type = day_plan["name"]
    muscles = day_plan["muscles"]

    # ── rest day ──
    if day_plan["type"] == "rest":
        return {
            "workout_type": "Rest",
            "recommended_exercises": [],
            "plan_metadata": {
                "total_exercises": 0,
                "estimated_duration_minutes": 0,
                "focus_areas": [
                    "rest",
                    f"weekly_split:{split_name}",
                    f"day_{day_of_week}:rest",
                ],
            },
        }

    params = goal_params(goal, target_cal)

    # ── fetch real exercises from DB ──
    exercises_per_muscle = 3 if len(muscles) == 1 else 2
    all_db_exercises: List[Dict] = []
    for mg in muscles:
        exs = await fetch_exercises_by_muscle(mg, limit=exercises_per_muscle + 3)
        # Prefer compound movements first (rough heuristic: shorter names are often compounds)
        exs_sorted = sorted(exs, key=lambda e: len(e.get("name", "")))
        all_db_exercises.extend(exs_sorted[:exercises_per_muscle])

    recommended: List[Dict] = []
    for ex in all_db_exercises:
        ex_id   = ex["id"]
        ex_name = ex["name"]
        mg      = ex["muscle_group"]
        equip   = ex["equipment"]

        # ── progressive overload: check history ──
        last = get_last_performance(ex_id, logged_sets)

        if last:
            suggested_weight = progressive_overload_weight(
                last["weight_kg"], last["avg_rpe"]
            )
            prev_reps = last["reps"]
            # Nudge reps toward goal target over time
            target_reps = params["reps"]
            if abs(prev_reps - target_reps) <= 2:
                reps = target_reps
            else:
                reps = prev_reps + (1 if prev_reps < target_reps else -1)

            rationale = (
                f"Based on your last session ({last['weight_kg']}kg × {last['reps']} reps"
                + (f", RPE {last['avg_rpe']:.1f}" if last["avg_rpe"] else "")
                + f"). Progressive overload applied → {suggested_weight}kg."
            )
        else:
            # No history — estimate from bodyweight and level
            suggested_weight = estimate_base_weight(ex_name, mg, equip, weight_kg, level)
            reps = params["reps"]
            rationale = (
                f"No previous data for this exercise. "
                f"Starting weight estimated from your bodyweight and {level} level. "
                f"{params['intensity_label'].capitalize()}."
            )

        sets = params["sets"]
        rest = params["rest"]

        # Duration estimate per set: reps * ~3s + rest
        estimated_duration = math.ceil(sets * (reps * 3 + rest) / 60)

        recommended.append({
            "exercise_id": ex_id,
            "exercise_name": ex_name,
            "muscle_group": mg,
            "target_sets": sets,
            "target_reps": reps,
            "suggested_weight_kg": float(suggested_weight),
            "rest_seconds": rest,
            "rationale": rationale,
        })

    total_duration = sum(
        math.ceil(ex["target_sets"] * (ex["target_reps"] * 3 + ex["rest_seconds"]) / 60)
        for ex in recommended
    )

    focus_areas = muscles.copy()
    focus_areas.append(f"weekly_split:{split_name}")
    focus_areas.append(f"day_{day_of_week}:{day_plan['type']}")

    return {
        "workout_type": workout_type,
        "recommended_exercises": recommended,
        "plan_metadata": {
            "total_exercises": len(recommended),
            "estimated_duration_minutes": total_duration,
            "focus_areas": focus_areas,
        },
    }


# ══════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"status": "ok", "service": "workout_recommendation"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "workout_recommendation", "version": "2.0.0"}


@app.post("/workout/recommend")
async def recommend_workout(request: WorkoutRequest):
    try:
        logger.info(f"Generating personalised workout: user={request.user_id} date={request.date}")

        # Fetch data in parallel-ish (sequential but cheap — cached in practice)
        profile     = await fetch_user_profile(request.user_id)
        logged_sets = await fetch_recent_logged_sets(request.user_id, days_back=28)

        logger.info(
            f"Profile found: {bool(profile)} | "
            f"History: {len(logged_sets)} sets from last 28 days"
        )

        plan = await build_day_recommendation(request.date, profile, logged_sets)

        logger.info(
            f"Generated {plan['workout_type']} workout with "
            f"{plan['plan_metadata']['total_exercises']} exercises"
        )

        return JSONResponse(status_code=200, content=plan)

    except ValueError as e:
        logger.error(f"Invalid input: {e}")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
