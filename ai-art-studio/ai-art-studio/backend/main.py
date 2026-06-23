"""
AI Art Studio — FastAPI Backend (Replicate edition)
Inference is delegated to Replicate's API — no GPU needed on this server.
Requires: REPLICATE_API_TOKEN environment variable.
"""

import uuid
import asyncio
import base64
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

# Load local .env file if present
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                key, val = line.strip().split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from inference import InferenceEngine

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-art-studio")

# ── Global state ───────────────────────────────────────────────────────────
jobs: dict[str, dict] = {}  # job_id → {status, result_image, error}
engine: Optional[InferenceEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Loading inference engine…")
    engine = InferenceEngine()
    await engine.load()
    logger.info("Inference engine ready ✓")
    yield
    logger.info("Shutting down inference engine…")
    await engine.unload()


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Art Studio API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded JPEG/PNG control image (512×512)")
    prompt: str = Field(..., max_length=2000)
    negative_prompt: str = Field(default="", max_length=1000)
    control_mode: str = Field(default="canny", pattern="^(canny|depth|pose|hed|normal)$")
    model: str = Field(default="sdxl", pattern="^(flux|sdxl|sd15)$")
    controlnet_conditioning_scale: float = Field(default=0.8, ge=0.0, le=2.0)
    num_inference_steps: int = Field(default=20, ge=5, le=50)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=30.0)
    seed: int = Field(default=-1)


class GenerateResponse(BaseModel):
    job_id: str
    status: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending | running | completed | failed
    original_image: Optional[str] = None
    result_image: Optional[str] = None
    result_url: Optional[str] = None
    error: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    import os
    token_set = bool(os.environ.get("REPLICATE_API_TOKEN"))
    return {
        "status": "ok",
        "engine_loaded": engine is not None and engine.is_loaded,
        "replicate_token_set": token_set,
    }


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "original_image": req.image
    }

    # Kick off background inference
    background_tasks.add_task(run_inference, job_id, req)

    return GenerateResponse(job_id=job_id, status="pending")


@app.get("/job/{job_id}", response_model=JobStatus)
async def job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    j = jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=j["status"],
        original_image=j.get("original_image"),
        result_image=j.get("result_image"),
        result_url=j.get("result_url"),
        error=j.get("error"),
    )


@app.delete("/job/{job_id}")
async def delete_job(job_id: str):
    jobs.pop(job_id, None)
    return {"deleted": job_id}


@app.get("/models")
async def list_models():
    return {
        "models": ["flux", "sdxl", "sd15"],
        "controlnet_modes": ["canny", "depth", "pose", "hed", "normal"],
    }


# ── Background task ────────────────────────────────────────────────────────
async def run_inference(job_id: str, req: GenerateRequest):
    jobs[job_id]["status"] = "running"
    try:
        logger.info(f"[{job_id[:8]}] Starting inference — model={req.model} mode={req.control_mode}")

        # Decode input image
        image_bytes = base64.b64decode(req.image)

        result_bytes, result_url = await asyncio.to_thread(
            engine.generate,
            image_bytes=image_bytes,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            control_mode=req.control_mode,
            model=req.model,
            controlnet_conditioning_scale=req.controlnet_conditioning_scale,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            seed=req.seed,
        )

        result_b64 = base64.b64encode(result_bytes).decode()
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["result_image"] = result_b64
        jobs[job_id]["result_url"] = result_url
        logger.info(f"[{job_id[:8]}] Completed ✓")

    except Exception as e:
        logger.error(f"[{job_id[:8]}] Failed: {e}", exc_info=True)
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
