"""
Async traffic simulator — generates a controllable stream of network events.

State machine:
  pipeline loading  → sends {"type":"status", "status":"..."}
  stopped           → sends {"type":"status", "status":"stopped"} at 2 Hz
  running           → sends packet/attack events at ~4 Hz
  inject queue      → always checked first regardless of running state
"""
import asyncio, time, random
from datetime import datetime, timezone
import numpy as np

from backend.pipeline  import MLPipeline
from backend.state     import SimState

TICK_MS        = 250       # ms between normal packets when running
ATTACK_EVERY_N = 25        # auto-inject attack roughly every N packets
BURST_SIZE     = (3, 7)
HISTORY_LEN    = 5


class TrafficSimulator:
    def __init__(self, pipeline: MLPipeline, state: SimState):
        self.pipeline     = pipeline
        self.state        = state
        self._packet_id   = 0
        self._history     = []
        self._burst_left  = 0
        self._burst_type  = None

    # ── main async generator ─────────────────────────────────────────────

    async def stream(self):
        while True:
            # ── model not ready ─────────────────────────────────────────
            if not self.pipeline.ready:
                yield {"type": "status", "status": self.pipeline.status}
                await asyncio.sleep(1.0)
                continue

            # ── manual injection queue (processed even when stopped) ────
            try:
                item = self.state.inject_queue.get_nowait()
                async for event in self._process_inject(item):
                    yield event
                continue
            except asyncio.QueueEmpty:
                pass

            # ── stopped ─────────────────────────────────────────────────
            if not self.state.running:
                yield {"type": "status", "status": "stopped"}
                await asyncio.sleep(0.5)
                continue

            # ── normal simulation tick ───────────────────────────────────
            t0 = time.monotonic()
            event = await self._tick()
            yield event
            self._packet_id += 1

            elapsed = (time.monotonic() - t0) * 1000
            await asyncio.sleep(max(0, TICK_MS - elapsed) / 1000)

    # ── private helpers ──────────────────────────────────────────────────

    async def _tick(self) -> dict:
        """Generate one automatic packet (normal or auto-attack burst)."""
        if self._burst_left > 0:
            is_attack = True
            self._burst_left -= 1
        elif self._packet_id > 0 and (self._packet_id % ATTACK_EVERY_N) == 0:
            self._burst_left = random.randint(*BURST_SIZE) - 1
            self._burst_type = _random_attack_type()
            is_attack = True
        else:
            is_attack = False

        if is_attack:
            x, _  = self.pipeline.sample_attack()
            atype = self._burst_type or _random_attack_type()
        else:
            x     = self.pipeline.sample_normal()
            atype = None

        return await self._make_event(x, atype, source="auto")

    async def _process_inject(self, item: dict):
        """Process one inject-queue item (may yield multiple events)."""
        count = max(1, min(int(item.get("count", 1)), 50))
        itype = item.get("type", "normal")
        atype = item.get("attack_type")

        for _ in range(count):
            if itype == "attack":
                x, _ = self.pipeline.sample_attack()
                event = await self._make_event(x, atype or _random_attack_type(), source="manual")
            else:
                x     = self.pipeline.sample_normal()
                event = await self._make_event(x, None, source="manual")
            self._packet_id += 1
            yield event
            await asyncio.sleep(0.05)

    async def _make_event(self, x: np.ndarray, attack_type, source: str) -> dict:
        self._history.append(x)
        if len(self._history) > 20:
            self._history.pop(0)

        event = {
            "type":        "packet",
            "packet_id":   self._packet_id,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            "prob":        0.0,
            "is_attack":   False,
            "attack_type": None,
            "source":      source,
            "raw_features": self.pipeline.raw_features(x),
        }

        if len(self._history) < HISTORY_LEN + 1:
            return event

        history  = np.array(self._history[-(HISTORY_LEN + 1):-1], dtype=np.float32)
        loop     = asyncio.get_event_loop()
        prob     = await loop.run_in_executor(None, self.pipeline.detect, x, history)

        event["prob"]      = round(float(prob), 4)
        event["is_attack"] = bool(prob > 0.5)

        if prob > 0.5:
            event["type"]        = "attack"
            event["attack_type"] = attack_type or _random_attack_type()
            explain_fn = (
                self.pipeline.explain_xnids
                if self.state.mode == 'xnids'
                else self.pipeline.explain
            )
            explanation = await loop.run_in_executor(None, explain_fn, x, history)
            event.update(explanation)

        return event


def _random_attack_type() -> str:
    r = random.random()
    if r < 0.62: return "DoS"
    if r < 0.84: return "Probe"
    if r < 0.96: return "R2L"
    return "U2R"
