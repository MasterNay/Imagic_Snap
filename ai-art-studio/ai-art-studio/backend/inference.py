"""
inference.py — Replicate API backend
Replaces the local Diffusers engine with Replicate-hosted ControlNet models.
No GPU required on the server — inference runs on Replicate's cloud.
"""

import io
import base64
import logging
import urllib.request
from typing import Optional

logger = logging.getLogger("inference")

# ── Replicate model versions ───────────────────────────────────────────────
# Each entry is the full "owner/model:version" string from replicate.com
REPLICATE_MODELS = {
    "sdxl": {
        "canny":  "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd1797644cc5f68e4fe6f4b",
        "depth":  "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd1797644cc5f68e4fe6f4b",
        "pose":   "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd1797644cc5f68e4fe6f4b",
        "hed":    "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd1797644cc5f68e4fe6f4b",
        "normal": "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd1797644cc5f68e4fe6f4b",
    },
    "sd15": {
        "canny":  "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613",
        "depth":  "jagilley/controlnet-depth2img:922c7bb67b87ec32cbe86d21f0e48af3f37fbd56e8cb5adcbb5f74e75f5ef7b",
        "pose":   "jagilley/controlnet-pose:269a616c8b0c2bbc12fc15fd51bb202b11e94ff0f7786c026aa905305c4ed9fb",
        "hed":    "jagilley/controlnet-hed:cde353130c86f37d0af4060cd757ab3009cac68eb58df216768f907f0d0a0653",
        "normal": "jagilley/controlnet-normal:cc8066f617b6c99fdb134bc1195c5291cf2610875da4985a39de50ee1f46d81c",
    },
}

# controlnet_type value expected by the sdxl model for each mode
SDXL_CONTROLNET_TYPE = {
    "canny":  "canny",
    "depth":  "depth",
    "pose":   "openpose",
    "hed":    "softedge",
    "normal": "normal",
}


class InferenceEngine:
    def __init__(self):
        self.is_loaded = False
        self._client = None

    async def load(self):
        try:
            import replicate  # noqa: F401
            self.is_loaded = True
            logger.info("Replicate client ready ✓")
        except ImportError:
            raise ImportError(
                "replicate package not found — run: pip install replicate"
            )

    async def unload(self):
        self.is_loaded = False

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
        """Call Replicate API and return PNG bytes of the result."""
        import io
        import replicate

        # Wrap image bytes in a file-like BytesIO object. 
        # The Replicate SDK automatically uploads file-like objects to their storage.
        image_file = io.BytesIO(image_bytes)
        image_file.name = "input_image.jpg"  # Set name so Replicate uploads with .jpg extension instead of .bin
        image_file.seek(0)

        # Always use xai/grok-imagine-image
        model_version = "xai/grok-imagine-image"
        inp = {
            "prompt":       prompt,
            "image":        image_file,
            "aspect_ratio": "1:1",
        }

        logger.info(f"Calling Replicate: {model_version.split(':')[0]}")

        # replicate.run() blocks until the prediction completes
        output = replicate.run(model_version, input=inp)

        logger.info(f"Raw output type: {type(output)}, value: {output!r}")

        # flux-kontext-pro returns a single FileOutput; other models return a list
        if isinstance(output, list):
            file_output = output[0]
        else:
            file_output = output

        # FileOutput has a .url() method; fall back to str() for plain URL strings
        if hasattr(file_output, 'url'):
            result_url = file_output.url()
        else:
            result_url = str(file_output)

        logger.info(f"Result URL: {result_url}")

        # Download the result image
        with urllib.request.urlopen(result_url) as resp:
            image_bytes_out = resp.read()

        return image_bytes_out, result_url
