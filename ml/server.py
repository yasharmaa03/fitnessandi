"""
server.py — FastAPI inference server for food recognition.

Loads the EfficientNetV2-S classifier and the nutrition database once at
startup via FastAPI's lifespan context manager, then exposes a POST /analyze
endpoint (added in task 6.2).

Usage:
    uvicorn ml.server:app --host 0.0.0.0 --port 8000
"""

import io
import json
import logging
import sys
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from torchvision import transforms

from ml.train import build_model
from ml.meal_recommender.rank_meals import get_ranker

# ---------------------------------------------------------------------------
# Paths — resolved relative to this file so the server works regardless of
# the current working directory.
# ---------------------------------------------------------------------------
_MODEL_PATH = Path(__file__).parent / "food_classifier.pth"
_DB_PATH = Path(__file__).parent / "nutrition_db.json"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — load resources exactly once at startup; exit non-zero on failure.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the classifier and nutrition database before serving requests."""

    # --- Load nutrition_db.json -------------------------------------------
    try:
        with open(_DB_PATH, "r", encoding="utf-8") as fh:
            nutrition_db = json.load(fh)
        logger.info("Loaded nutrition database from %s", _DB_PATH)
    except FileNotFoundError:
        logger.error(
            "Nutrition database not found: path=%s failure=FileNotFoundError",
            _DB_PATH,
        )
        sys.exit(1)
    except json.JSONDecodeError as exc:
        logger.error(
            "Nutrition database could not be parsed: path=%s failure=JSONDecodeError detail=%s",
            _DB_PATH,
            exc,
        )
        sys.exit(1)

    # --- Load food_classifier.pth -----------------------------------------
    try:
        model = build_model()
        state_dict = torch.load(_MODEL_PATH, map_location="cpu", weights_only=True)
        model.load_state_dict(state_dict)
        model.eval()
        logger.info("Loaded classifier from %s", _MODEL_PATH)
    except FileNotFoundError:
        logger.error(
            "Classifier weights not found: path=%s failure=FileNotFoundError",
            _MODEL_PATH,
        )
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Classifier could not be loaded: path=%s failure=%s",
            _MODEL_PATH,
            exc,
        )
        sys.exit(1)

    # --- Load meal ranker (LightGBM) --------------------------------------
    try:
        meal_ranker = get_ranker()
        logger.info("Loaded meal ranker successfully")
        app.state.meal_ranker = meal_ranker
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load meal ranker: %s", exc)
        # Don't exit - meal ranking is optional, food classifier is primary
        app.state.meal_ranker = None

    # --- Publish to app.state so request handlers can access them ----------
    app.state.model = model
    app.state.nutrition_db = nutrition_db

    yield  # server is running; requests are served here

    # Cleanup (none required — Python GC handles tensors)


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(title="Food Recognition Inference Server", lifespan=lifespan)

# Requirement 3.8: enable CORS for all origins so the Next.js dev server
# (and any other client) can reach this API without browser-level blocking.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Inference transform — must match val_transform from train.py exactly so
# the model receives identically pre-processed pixels at inference time.
# ---------------------------------------------------------------------------
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]

_inference_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=_IMAGENET_MEAN, std=_IMAGENET_STD),
])

# Allowed MIME types (Requirement 3.3)
_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

# Maximum upload size: 10 MB (Requirement 3.3)
_MAX_FILE_BYTES = 10 * 1024 * 1024


# ---------------------------------------------------------------------------
# POST /analyze
# ---------------------------------------------------------------------------
@app.post("/analyze")
async def analyze(request: Request, file: UploadFile = File(...)):
    """
    Accept a food image, run the classifier, and return macro estimates.

    Validations (Requirement 3.3, 3.6):
      - MIME type must be image/jpeg, image/png, or image/webp.
      - File size must not exceed 10 MB.

    Returns (Requirement 3.4):
      - food, confidence (percentage string, 2 dp), top3, macros
      - low_confidence: true only when top-1 score < 0.50 (Requirement 3.5)

    Errors:
      - HTTP 422 for invalid size/type or missing category (Requirements 3.6, 3.7)
      - HTTP 500 with logged stack trace for unexpected errors (Requirement 3.8)
    """
    # --- MIME type validation ------------------------------------------------
    if file.content_type not in _ALLOWED_MIME_TYPES:
        return JSONResponse(
            status_code=422,
            content={"detail": f"Rejected: unsupported file type {file.content_type}"},
        )

    # --- Read file bytes and size validation ---------------------------------
    image_bytes = await file.read()
    if len(image_bytes) > _MAX_FILE_BYTES:
        return JSONResponse(
            status_code=422,
            content={"detail": "Rejected: file size exceeds 10 MB"},
        )

    # --- Inference pipeline --------------------------------------------------
    try:
        # Step 1: decode image bytes → PIL Image (RGB) → apply transform → tensor
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _inference_transform(pil_image)      # (3, 224, 224)
        tensor = tensor.unsqueeze(0)                  # (1, 3, 224, 224)

        model = request.app.state.model
        nutrition_db = request.app.state.nutrition_db

        # Step 2: forward pass → softmax probabilities
        with torch.no_grad():
            logits = model(tensor)                    # (1, 101)
        probs = F.softmax(logits, dim=1).squeeze(0)   # (101,)

        # Step 3: top-3 indices and scores
        top3_scores, top3_indices = torch.topk(probs, 3)

        # Step 4: map indices to Food-101 class names.
        # We derive the canonical sorted list from the nutrition_db keys,
        # which covers exactly the 101 Food-101 categories.
        class_names = sorted(nutrition_db.keys())

        top1_idx = top3_indices[0].item()
        top1_score = top3_scores[0].item()
        top1_label = class_names[top1_idx]

        # Step 5: look up top-1 label in nutrition_db (Requirement 3.7)
        if top1_label not in nutrition_db:
            return JSONResponse(
                status_code=422,
                content={"detail": f"Unrecognized category: {top1_label}"},
            )

        entry = nutrition_db[top1_label]
        serving_size = entry["serving_size"]

        # Step 6: scale per-100 g macros by serving_size / 100 (Requirement 3.4)
        def scale(value):
            if value is None:
                return None
            return round(value * serving_size / 100, 2)

        macros = {
            "calories":  scale(entry["calories"]),
            "protein_g": scale(entry["protein_g"]),
            "carbs_g":   scale(entry["carbs_g"]),
            "fat_g":     scale(entry["fat_g"]),
            "fiber_g":   scale(entry["fiber_g"]),
        }

        # Step 7: build top3 list with confidence as percentage strings
        top3 = []
        for score, idx in zip(top3_scores.tolist(), top3_indices.tolist()):
            top3.append({
                "name":       class_names[idx],
                "confidence": f"{score * 100:.2f}",
            })

        # Step 8: assemble response
        response_body = {
            "food":       top1_label,
            "confidence": f"{top1_score * 100:.2f}",
            "top3":       top3,
            "macros":     macros,
        }

        # Include low_confidence only when top-1 score is below 0.50 (Requirement 3.5)
        if top1_score < 0.50:
            response_body["low_confidence"] = True

        return JSONResponse(status_code=200, content=response_body)

    except Exception:  # noqa: BLE001
        # Log full stack trace and return a generic 500 (Requirement 3.8)
        logger.error("Unexpected error during /analyze:\n%s", traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )


# ---------------------------------------------------------------------------
# POST /rank-meals
# ---------------------------------------------------------------------------
@app.post("/rank-meals")
async def rank_meals(request: Request):
    """
    Rank meal candidates using LightGBM model.
    
    Request body:
        {
            "candidates": [
                {
                    "meal_id": "unique_id",
                    "meal_name": "Chicken Curry",
                    "features": [f1, f2, f3, f4, f5, f6, f7],
                    ... (other meal fields)
                },
                ...
            ]
        }
    
    Response:
        {
            "ranked": [
                {
                    "meal_id": "unique_id",
                    "meal_name": "Chicken Curry",
                    "score": 0.85,
                    "features": [...],
                    ... (other meal fields)
                },
                ...
            ]
        }
    
    Returns meals sorted by score (descending)
    """
    try:
        # Check if ranker is loaded
        meal_ranker = request.app.state.meal_ranker
        if meal_ranker is None:
            return JSONResponse(
                status_code=503,
                content={"detail": "Meal ranker not available"}
            )

        # Parse request body
        body = await request.json()
        candidates = body.get("candidates", [])

        if not candidates:
            return JSONResponse(
                status_code=422,
                content={"detail": "No candidates provided"}
            )

        # Rank meals
        ranked = meal_ranker.rank_meals(candidates)

        return JSONResponse(
            status_code=200,
            content={"ranked": ranked}
        )

    except ValueError as e:
        logger.error(f"Invalid request: {e}")
        return JSONResponse(
            status_code=422,
            content={"detail": str(e)}
        )
    except Exception as e:
        logger.error(f"Ranking error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )
