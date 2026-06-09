"""
AI Art Studio — FastAPI Backend
Handles generation jobs, queuing, and ControlNet inference dispatch.
"""

import uuid
import asyncio
import base64
import logging
from contextlib import asynccontextmanager
from typing import Optional

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
    prompt: str = Field(..., max_length=500)
    negative_prompt: str = Field(default="", max_length=300)
    control_mode: str = Field(default="canny", pattern="^(canny|depth|pose|hed|normal)$")
    model: str = Field(default="sdxl", pattern="^(sdxl|sd15)$")
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
    result_image: Optional[str] = None
    error: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine_loaded": engine is not None and engine.is_loaded,
    }


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending"}

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
        result_image=j.get("result_image"),
        error=j.get("error"),
    )


@app.delete("/job/{job_id}")
async def delete_job(job_id: str):
    jobs.pop(job_id, None)
    return {"deleted": job_id}


@app.get("/models")
async def list_models():
    return {
        "models": ["sdxl", "sd15"],
        "controlnet_modes": ["canny", "depth", "pose", "hed", "normal"],
    }


# ── Background task ────────────────────────────────────────────────────────
async def run_inference(job_id: str, req: GenerateRequest):
    jobs[job_id]["status"] = "running"
    try:
        logger.info(f"[{job_id[:8]}] Starting inference — model={req.model} mode={req.control_mode}")

        # Decode input image
        image_bytes = base64.b64decode(req.image)

        result_bytes = await asyncio.to_thread(
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
        logger.info(f"[{job_id[:8]}] Completed ✓")

    except Exception as e:
        logger.error(f"[{job_id[:8]}] Failed: {e}", exc_info=True)
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
