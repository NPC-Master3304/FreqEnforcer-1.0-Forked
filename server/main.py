"""FreqEnforcer FastAPI server."""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure the server package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from server.config import PORT, HOST, VERSION
from server.routes.audio import router as audio_router


@asynccontextmanager
async def lifespan(app):
    """Verify DSP module imports on startup."""
    try:
        from server.audio import (
            autotuner,
            cleanliness,
            harmonic_limiter,
            hnm_synth,
            loader,
            normalizer,
            pitch_detector,
            sinusoidal,
            time_stretch,
        )
    except ImportError as e:
        print(f"WARNING: DSP import failed: {e}")
        print("The server will still run, but audio processing may not work.")
    yield


app = FastAPI(title="FreqEnforcer", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": VERSION}


if __name__ == "__main__":
    try:
        uvicorn.run(app, host=HOST, port=PORT)
    except OSError as e:
        if "address already in use" in str(e).lower() or "10048" in str(e):
            print(f"ERROR: Port {PORT} is already in use. Please free the port or change PORT in config.py.")
            sys.exit(1)
        raise
