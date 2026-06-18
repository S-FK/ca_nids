"""Shared simulator state — one instance per process."""
import asyncio
from dataclasses import dataclass, field
from typing import Literal

@dataclass
class SimState:
    running:      bool                        = False
    mode:         Literal['xnids','ca_xnids'] = 'ca_xnids'
    inject_queue: asyncio.Queue               = field(default_factory=asyncio.Queue)

sim_state = SimState()
