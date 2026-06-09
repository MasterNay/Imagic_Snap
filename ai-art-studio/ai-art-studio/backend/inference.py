"""
inference.py — ControlNet + SDXL/SD1.5 Inference Engine
Uses Hugging Face Diffusers library.
"""

import io
import logging
from typing import Optional

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger("inference")

# ── ControlNet model IDs ───────────────────────────────────────────────────
CONTROLNET_IDS = {
    "sdxl": {
        "canny": "diffusers/controlnet-canny-sdxl-1.0",
        "depth": "diffusers/controlnet-depth-sdxl-1.0",
        "pose":  "thibaud/controlnet-openpose-sdxl-1.0",
        "hed":   "SargeZT/controlnet-sd-xl-1.0-softedge-dexined",
        "normal":"xinsir/controlnet-union-sdxl-1.0",
    },
    "sd15": {
        "canny": "lllyasviel/sd-controlnet-canny",
        "depth": "lllyasviel/sd-controlnet-depth",
        "pose":  "lllyasviel/sd-controlnet-openpose",
        "hed":   "lllyasviel/sd-controlnet-hed",
        "normal":"lllyasviel/sd-controlnet-normal",
    },
}

BASE_MODEL_IDS = {
    "sdxl": "stabilityai/stable-diffusion-xl-base-1.0",
    "sd15": "runwayml/stable-diffusion-v1-5",
}


class InferenceEngine:
    def __init__(self):
        self.is_loaded = False
        self._pipelines: dict[str, object] = {}  # "sdxl_canny" → pipeline
        self._preprocessors: dict[str, object] = {}
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        logger.info(f"Device: {self.device} | dtype: {self.dtype}")

    async def load(self):
        """
        Lazy-load: pipelines are loaded on first use to keep startup fast.
        We pre-import libraries here to catch import errors early.
        """
        try:
            import diffusers  # noqa: F401
            import controlnet_aux  # noqa: F401
            self.is_loaded = True
            logger.info("Diffusers & controlnet_aux available ✓")
        except ImportError as e:
            logger.error(f"Missing dependency: {e}")
            raise

    async def unload(self):
        self._pipelines.clear()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False

    def _get_pipeline(self, model: str, control_mode: str):
        """Load (and cache) the pipeline for model+mode combination."""
        key = f"{model}_{control_mode}"
        if key in self._pipelines:
            return self._pipelines[key]

        from diffusers import (
            ControlNetModel,
            StableDiffusionControlNetPipeline,
            StableDiffusionXLControlNetPipeline,
            UniPCMultistepScheduler,
        )

        controlnet_id = CONTROLNET_IDS[model][control_mode]
        base_id = BASE_MODEL_IDS[model]

        logger.info(f"Loading ControlNet: {controlnet_id}")
        controlnet = ControlNetModel.from_pretrained(
            controlnet_id,
            torch_dtype=self.dtype,
        )

        logger.info(f"Loading base model: {base_id}")
        if model == "sdxl":
            pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                base_id,
                controlnet=controlnet,
                torch_dtype=self.dtype,
                variant="fp16" if self.device == "cuda" else None,
                use_safetensors=True,
            )
        else:
            pipe = StableDiffusionControlNetPipeline.from_pretrained(
                base_id,
                controlnet=controlnet,
                torch_dtype=self.dtype,
                safety_checker=None,
            )

        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
        pipe = pipe.to(self.device)

        if self.device == "cuda":
            pipe.enable_xformers_memory_efficient_attention()
            pipe.enable_model_cpu_offload()

        self._pipelines[key] = pipe
        return pipe

    def _preprocess(self, image: Image.Image, control_mode: str) -> Image.Image:
        """Apply ControlNet preprocessor to extract the control signal."""
        from controlnet_aux import (
            CannyDetector,
            MidasDetector,
            OpenposeDetector,
            HEDdetector,
            NormalBaeDetector,
        )

        preprocessors = {
            "canny": CannyDetector,
            "depth": MidasDetector,
            "pose":  OpenposeDetector,
            "hed":   HEDdetector,
            "normal": NormalBaeDetector,
        }

        key = f"pre_{control_mode}"
        if key not in self._preprocessors:
            cls = preprocessors[control_mode]
            self._preprocessors[key] = cls.from_pretrained("lllyasviel/Annotators") \
                if hasattr(cls, "from_pretrained") else cls()

        detector = self._preprocessors[key]

        if control_mode == "canny":
            return detector(image, low_threshold=100, high_threshold=200)
        return detector(image)

    def generate(
        self,
        image_bytes: bytes,
        prompt: str,
        negative_prompt: str,
        control_mode: str,
        model: str,
        controlnet_conditioning_scale: float,
        num_inference_steps: int,
        guidance_scale: float,
        seed: int,
    ) -> bytes:
        """Run ControlNet inference and return PNG bytes."""
        # Decode input image
        input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((512, 512))

        # Preprocess to extract control signal
        control_image = self._preprocess(input_image, control_mode)

        # Load pipeline
        pipe = self._get_pipeline(model, control_mode)

        # Set seed
        generator = torch.Generator(device=self.device)
        if seed >= 0:
            generator.manual_seed(seed)
        else:
            generator.seed()

        # Run inference
        with torch.inference_mode():
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt or "low quality, blurry",
                image=control_image,
                controlnet_conditioning_scale=controlnet_conditioning_scale,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
                height=512,
                width=512,
            )

        output_image: Image.Image = result.images[0]

        # Return as PNG bytes
        buf = io.BytesIO()
        output_image.save(buf, format="PNG")
        return buf.getvalue()
