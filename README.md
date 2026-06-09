# ◈ AI Art Studio

Real-time AI image generation using **ControlNet + SDXL/SD1.5** driven by a live camera stream.

```
Camera (browser) → FastAPI Backend → Diffusers / ControlNet → Generated Image
     ↑                                                               ↓
  Next.js (Cloudflare Pages)  ←←←←←←←  Result (base64 PNG)  ←←←←←←
```

---

## Architecture

| Layer | Technology | Deploy target |
|-------|-----------|--------------|
| **Frontend** | Next.js 14 (React) | Cloudflare Pages |
| **Backend** | FastAPI (Python) | Any GPU VM / RunPod / vast.ai |
| **AI Inference** | Diffusers · ControlNet · SDXL | Same GPU host |

---

## Prerequisites

- Node.js ≥ 20
- Python 3.11+
- NVIDIA GPU (VRAM: 8GB min for SD1.5, 16GB+ for SDXL)
- Docker + nvidia-container-toolkit (optional but recommended)
- Cloudflare account

---

## Quick Start (Local Development)

### 1 — Backend

```bash
cd backend

# Create venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install (GPU)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

# Start server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or with Docker (requires nvidia-container-toolkit):

```bash
docker compose up --build
```

### 2 — Frontend

```bash
cd frontend
npm install

# Copy env
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

---

## Environment Variables

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_WS_URL=wss://your-backend.example.com
```

### Backend

```env
HF_TOKEN=hf_...           # Optional: needed for gated models
CUDA_VISIBLE_DEVICES=0
```

---

## Deploying to Cloudflare Pages (Frontend)

### Step 1 — Connect repository

1. Push your project to GitHub/GitLab.
2. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Select your repo.

### Step 2 — Build settings

| Setting | Value |
|---------|-------|
| Framework preset | Next.js |
| Build command | `npm run pages:build` |
| Build output directory | `.vercel/output/static` |
| Root directory | `frontend` |

### Step 3 — Environment variables (in CF Pages settings)

```
NEXT_PUBLIC_API_URL = https://your-gpu-backend.example.com
```

### Step 4 — Deploy

Cloudflare Pages builds and deploys automatically on every `git push`.

> **Note**: The `@cloudflare/next-on-pages` adapter converts Next.js to Cloudflare Pages-compatible static output.

---

## Deploying the Backend (GPU Server)

The FastAPI backend needs a **real GPU** — Cloudflare Workers don't support CUDA. Options:

### Option A — RunPod / vast.ai (Recommended for prototyping)

1. Rent a GPU pod (RTX 3090 or A100).
2. SSH in and clone your repo.
3. Run with Docker Compose.
4. Note the public URL and set `NEXT_PUBLIC_API_URL` in Cloudflare Pages.

### Option B — Cloudflare Tunnel (expose local GPU server)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

# Authenticate
./cloudflared login

# Tunnel local backend → public URL
./cloudflared tunnel --url http://localhost:8000
```

This gives you a `*.trycloudflare.com` URL — set it as `NEXT_PUBLIC_API_URL`.

### Option C — GCP / AWS / Azure with GPU instance

Build and run the Docker image:

```bash
docker build -t ai-art-studio-backend ./backend
docker run --gpus all -p 8000:8000 \
  -v $HOME/.cache/huggingface:/app/.cache/huggingface \
  ai-art-studio-backend
```

Put an HTTPS reverse proxy (nginx + certbot, or Caddy) in front.

---

## API Reference

### `POST /generate`

```json
{
  "image": "<base64 jpeg>",
  "prompt": "cinematic portrait, dramatic lighting",
  "negative_prompt": "blurry, low quality",
  "control_mode": "canny",         // canny | depth | pose | hed | normal
  "model": "sdxl",                  // sdxl | sd15
  "controlnet_conditioning_scale": 0.8,
  "num_inference_steps": 20,
  "guidance_scale": 7.5,
  "seed": -1
}
```

Returns: `{ "job_id": "uuid", "status": "pending" }`

### `GET /job/{job_id}`

Returns: `{ "status": "completed", "result_image": "<base64 png>" }`

### `GET /health`

Returns: `{ "status": "ok", "engine_loaded": true }`

---

## ControlNet Modes

| Mode | What it detects | Best for |
|------|----------------|----------|
| `canny` | Hard edges | Architectural, product shots |
| `depth` | Depth from monocular | Landscape, 3D-style |
| `pose` | Body keypoints | Portrait, character art |
| `hed` | Soft edges | Sketch-to-image |
| `normal` | Surface normals | 3D look, materials |

---

## VRAM Requirements

| Model | Mode | Approx VRAM |
|-------|------|-------------|
| SD 1.5 | any | 6–8 GB |
| SDXL | any | 12–16 GB |
| SDXL | with CPU offload | 8 GB |

CPU offload is enabled automatically when `cuda` device is detected.

---

## Project Structure

```
ai-art-studio/
├── frontend/                   # Next.js app (→ Cloudflare Pages)
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   ├── components/         # CameraStream, ControlPanel, GeneratedCanvas, StatusBar
│   │   ├── store/              # Zustand camera state
│   │   └── lib/
│   ├── public/
│   │   └── _headers            # Cloudflare Pages headers (CORS, CSP)
│   ├── next.config.js
│   └── wrangler.toml
│
├── backend/                    # FastAPI (→ GPU VM)
│   ├── main.py                 # Routes, job queue
│   ├── inference.py            # ControlNet + SDXL/SD1.5 engine
│   ├── requirements.txt
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## License

MIT
