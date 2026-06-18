"""
CA-xNIDS FastAPI backend.

REST
----
GET  /api/health                 liveness
GET  /api/status                 pipeline + sim status
POST /api/control  { action }    start | stop
POST /api/inject   { ... }       queue a manual packet injection

WebSocket
---------
WS /ws   real-time event stream (JSON per packet)
"""
import threading
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.pipeline  import MLPipeline
from backend.simulator import TrafficSimulator
from backend.state     import sim_state

_pipeline = MLPipeline()


@asynccontextmanager
async def lifespan(app: FastAPI):
    t = threading.Thread(target=_pipeline.setup, daemon=True, name="pipeline-setup")
    t.start()
    yield


app = FastAPI(title="CA-xNIDS Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST ──────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/status")
async def status():
    return {
        "pipeline_status": _pipeline.status,
        "pipeline_ready":  _pipeline.ready,
        "sim_running":     sim_state.running,
        "mode":            sim_state.mode,
    }


class ControlBody(BaseModel):
    action: Literal["start", "stop"]

@app.post("/api/control")
async def control(body: ControlBody):
    sim_state.running = (body.action == "start")
    return {"ok": True, "running": sim_state.running}


class InjectBody(BaseModel):
    type: Literal["normal", "attack"] = "normal"
    attack_type: str | None = None
    count: int = 1

class ModeBody(BaseModel):
    mode: Literal['xnids', 'ca_xnids']

@app.post("/api/mode")
async def set_mode(body: ModeBody):
    sim_state.mode = body.mode
    return {"ok": True, "mode": sim_state.mode}


@app.post("/api/inject")
async def inject(body: InjectBody):
    if not _pipeline.ready:
        return {"ok": False, "error": "pipeline not ready"}
    await sim_state.inject_queue.put(body.model_dump())
    return {"ok": True, "queued": body.count}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    sim = TrafficSimulator(_pipeline, sim_state)
    try:
        async for event in sim.stream():
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[ws] {exc}")
