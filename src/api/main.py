"""
StreamForge Topology & Telemetry API
Exposes endpoints for:
  - WebSocket live telemetry feeds (/ws/live)
  - Worker subprocess management (start, kill, status)
  - Topology metadata (/topology)
  - Prometheus metrics (/metrics)
  - Health check (/health)
  - Stack status (/api/status)
"""

import os
import sys
import json
import uuid
import time
import shutil
import logging
import threading
import subprocess
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from prometheus_client import Counter, generate_latest
from confluent_kafka import Consumer, KafkaError

from src.api.stack_health import build_stack_status
from src.stream_processor.config import (
    APP_ID,
    HOPPING_STEP_SECONDS,
    WINDOW_SIZE_SECONDS,
)

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("streamforge_api")

app = FastAPI(title="StreamForge Topology API")

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
health_counter = Counter("health_requests_total", "Total requests to /health")
telemetry_counter = Counter("telemetry_messages_total", "Total telemetry messages consumed")

# Workspace root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Global State for Telemetry
class TelemetryState:
    def __init__(self):
        self.lock = threading.Lock()
        self.total_readings = 0
        self.total_aggregates = 0
        self.ingestion_rate = 0.0
        self.filter_rate = 0.0
        self.duplicate_drop_rate = 0.0
        self.aggregate_rate = 0.0
        self.message_times = []
        self.duplicate_times = []
        self.filtered_times = []
        self.aggregate_times = []
        self.recent_readings = []
        self.trucks: Dict[int, dict] = {}
        self.anomalies = []
        self.active_connections: Set[WebSocket] = set()
        self._seen_keys: Set[tuple[int, str]] = set()
        self._seen_order: list[tuple[int, str]] = []
        self.kafka_connected = False

    def _track_seen(self, truck_id: int, timestamp: str) -> bool:
        """Return True if this (truck_id, timestamp) was already observed."""
        key = (truck_id, timestamp)
        if key in self._seen_keys:
            return True
        self._seen_keys.add(key)
        self._seen_order.append(key)
        if len(self._seen_order) > 10_000:
            oldest = self._seen_order.pop(0)
            self._seen_keys.discard(oldest)
        return False

    def add_reading(self, reading: dict):
        truck_id = reading.get("truck_id")
        temp = reading.get("temperature")
        ts = reading.get("timestamp")
        fuel = reading.get("fuel_level")
        now = time_now_seconds()

        with self.lock:
            if truck_id is None or ts is None:
                return

            if self._track_seen(truck_id, ts):
                self.duplicate_times.append(now)
                return

            if temp is not None and temp <= 0:
                self.filtered_times.append(now)
                return

            self.total_readings += 1
            self.message_times.append(now)

            if truck_id not in self.trucks:
                self.trucks[truck_id] = {
                    "truck_id": truck_id,
                    "last_temperature": temp,
                    "last_timestamp": ts,
                    "fuel_level": fuel,
                    "tumbling_avg": None,
                    "hopping_avg": None,
                    "reading_count": 0,
                    "status": "active"
                }
            else:
                self.trucks[truck_id]["last_temperature"] = temp
                self.trucks[truck_id]["last_timestamp"] = ts
                if fuel is not None:
                    self.trucks[truck_id]["fuel_level"] = fuel

            if temp is not None and temp > 42.0:
                anomaly = {
                    "truck_id": truck_id,
                    "temperature": temp,
                    "timestamp": ts,
                    "type": "High Temperature Alert",
                    "severity": "critical" if temp > 45 else "warning"
                }
                self.anomalies.append(anomaly)
                if len(self.anomalies) > 50:
                    self.anomalies.pop(0)

            self.recent_readings.append(reading)
            if len(self.recent_readings) > 50:
                self.recent_readings.pop(0)

    def add_aggregate(self, aggregate: dict):
        with self.lock:
            self.total_aggregates += 1
            self.aggregate_times.append(time_now_seconds())

            truck_id = aggregate.get("truck_id")
            w_type = aggregate.get("window_type")
            avg_temp = aggregate.get("average_temperature")
            count = aggregate.get("reading_count")

            if truck_id in self.trucks:
                if w_type == "tumbling":
                    self.trucks[truck_id]["tumbling_avg"] = avg_temp
                elif w_type == "hopping":
                    self.trucks[truck_id]["hopping_avg"] = avg_temp
                self.trucks[truck_id]["reading_count"] += count

    def _rate_from_times(self, times: list[float], window: float = 5.0) -> float:
        now = time_now_seconds()
        kept = [t for t in times if now - t <= window]
        times[:] = kept
        return round(len(kept) / window, 2)

    def update_rates(self):
        with self.lock:
            self.ingestion_rate = self._rate_from_times(self.message_times)
            self.filter_rate = self._rate_from_times(self.filtered_times)
            self.duplicate_drop_rate = self._rate_from_times(self.duplicate_times)
            self.aggregate_rate = self._rate_from_times(self.aggregate_times)

    def get_snapshot(self) -> dict:
        with self.lock:
            sorted_trucks = sorted(self.trucks.values(), key=lambda t: t["truck_id"])
            return {
                "total_readings": self.total_readings,
                "total_aggregates": self.total_aggregates,
                "ingestion_rate": self.ingestion_rate,
                "filter_rate": self.filter_rate,
                "duplicate_drop_rate": self.duplicate_drop_rate,
                "aggregate_rate": self.aggregate_rate,
                "kafka_connected": self.kafka_connected,
                "recent_readings": list(reversed(self.recent_readings))[:20],
                "trucks": sorted_trucks[:200],
                "anomalies": list(reversed(self.anomalies))[:15],
            }

def time_now_seconds() -> float:
    return datetime.now(timezone.utc).timestamp()

state = TelemetryState()

def resolve_python_exe() -> str:
    win = REPO_ROOT / ".venv" / "Scripts" / "python.exe"
    unix = REPO_ROOT / ".venv" / "bin" / "python"
    if win.exists():
        return str(win)
    if unix.exists():
        return str(unix)
    return shutil.which("python") or shutil.which("python3") or "python"


def faust_state_dirs() -> List[Path]:
    return [
        REPO_ROOT / f"{APP_ID}-dat",
        REPO_ROOT / "streamforge-dat",
        REPO_ROOT / "streamforge-data",
    ]


# Worker Manager class
class WorkerManager:
    def __init__(self):
        self.workers = {
            "stream-processor": {
                "proc": None,
                "status": "stopped",
                "pid": None,
                "label": "Faust Stream Processor",
            },
        }
        self.lock = threading.Lock()

    def start_worker(self, name: str) -> bool:
        with self.lock:
            if name not in self.workers:
                return False

            if self.workers[name]["status"] == "running":
                return True

            logger.info("Spawning worker subprocess for %s...", name)

            cmd = [
                resolve_python_exe(),
                "-m",
                "src.stream_processor.topology",
                "worker",
                "-l",
                "info",
                "--without-web",
            ]

            log_dir = REPO_ROOT / "logs"
            log_dir.mkdir(exist_ok=True)
            log_file = open(log_dir / f"{name}.log", "a")

            child_env = os.environ.copy()
            if "DEMO_MODE" not in child_env:
                child_env["DEMO_MODE"] = "1"

            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(REPO_ROOT),
                    stdout=log_file,
                    stderr=log_file,
                    env=child_env,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
                )
                self.workers[name]["proc"] = proc
                self.workers[name]["pid"] = proc.pid
                self.workers[name]["status"] = "running"
                logger.info("Worker %s successfully started with PID %d", name, proc.pid)
                return True
            except Exception as e:
                logger.error("Failed to start worker %s: %s", name, e)
                return False

    def kill_worker(self, name: str, wipe_state: bool = True) -> bool:
        with self.lock:
            if name not in self.workers:
                return False

            w = self.workers[name]
            proc = w["proc"]

            if proc is not None:
                logger.warning("Killing worker %s (PID %d)...", name, w["pid"])
                try:
                    proc.kill()
                    proc.wait(timeout=2.0)
                except Exception as e:
                    logger.error("Error waiting for worker kill: %s", e)
                w["proc"] = None
                w["pid"] = None

            w["status"] = "stopped"

            # Chaos: wipe Faust local state dirs (simulated disk loss on crash)
            if wipe_state:
                for data_dir in faust_state_dirs():
                    if data_dir.exists():
                        logger.info("Removing Faust state dir %s", data_dir)
                        try:
                            shutil.rmtree(data_dir, ignore_errors=True)
                        except Exception as e:
                            logger.error("Failed to delete state dir %s: %s", data_dir, e)

            logger.info("Worker %s is terminated", name)
            return True

    def get_status(self) -> List[dict]:
        with self.lock:
            status_list = []
            for name, w in self.workers.items():
                proc = w["proc"]
                if proc is not None and proc.poll() is not None:
                    w["status"] = "stopped"
                    w["pid"] = None
                    w["proc"] = None

                status_list.append({
                    "id": name,
                    "label": w.get("label", name),
                    "status": w["status"],
                    "pid": w["pid"],
                    "role": "dedup → filter → map → tumbling + hopping → truck-averages",
                })
            return status_list

    def shutdown_all(self):
        for name in list(self.workers.keys()):
            self.kill_worker(name, wipe_state=False)

worker_manager = WorkerManager()

# The event loop uvicorn serves WebSocket connections on. The consumer runs in
# a plain thread, so it can't await sends directly — it hands each broadcast to
# THIS loop via run_coroutine_threadsafe. Captured at startup (see below), when
# a running loop actually exists.
main_loop: asyncio.AbstractEventLoop | None = None

# Background Thread for consuming Kafka events
def kafka_consumer_thread():
    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    group_id = f"streamforge-api-{uuid.uuid4()}"
    
    logger.info("Initializing API Kafka Consumer subscribing to bootstrap %s", bootstrap_servers)
    
    consumer = None
    retries = 0
    while consumer is None:
        try:
            consumer = Consumer({
                "bootstrap.servers": bootstrap_servers,
                "group.id": group_id,
                "auto.offset.reset": "latest",
                "enable.auto.commit": True
            })
            consumer.subscribe(["truck-telemetry", "truck-averages"])
            state.kafka_connected = True
            logger.info("API Kafka Consumer subscribed successfully to truck-telemetry and truck-averages")
        except Exception as e:
            retries += 1
            logger.error("Failed to create Kafka consumer (retry %d): %s", retries, e)
            time.sleep(5)
            
    # Rate calculations update interval
    last_rate_update = time_now_seconds()
    
    while True:
        try:
            msg = consumer.poll(0.1)
            
            # Periodic rate calculation & WebSocket push
            now = time_now_seconds()
            if now - last_rate_update >= 1.0:
                state.update_rates()
                last_rate_update = now
                
                # Broadcast state snapshot to all open WebSockets
                if state.active_connections and main_loop is not None:
                    snapshot = {
                        "type": "telemetry",
                        "data": state.get_snapshot(),
                        "workers": worker_manager.get_status()
                    }
                    # Hand the send to uvicorn's running loop from this thread.
                    asyncio.run_coroutine_threadsafe(broadcast_json(snapshot), main_loop)
            
            if msg is None:
                continue
                
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error("Consumer error: %s", msg.error())
                continue
                
            topic = msg.topic()
            payload = json.loads(msg.value().decode("utf-8"))
            
            if topic == "truck-telemetry":
                telemetry_counter.inc()
                state.add_reading(payload)
            elif topic == "truck-averages":
                state.add_aggregate(payload)
                
        except Exception as e:
            logger.error("Error in consumer thread loop: %s", e)
            time.sleep(1)

# Helper to run coroutine thread-safe
async def broadcast_json(payload: dict):
    disconnected = []
    for ws in list(state.active_connections):
        try:
            await ws.send_json(payload)
        except Exception:
            disconnected.append(ws)
            
    for ws in disconnected:
        state.active_connections.discard(ws)

@app.on_event("startup")
async def start_consumer():
    # Capture the loop uvicorn is actually running WebSockets on, then start the
    # consumer. Starting the thread at import time (before this loop exists) is
    # why broadcasts previously went to a dead loop and never reached clients.
    global main_loop
    main_loop = asyncio.get_running_loop()
    threading.Thread(target=kafka_consumer_thread, daemon=True).start()

# API Endpoints
@app.get("/health")
def health():
    health_counter.inc()
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type="text/plain")

@app.get("/topology")
def topology():
    tumble_label = f"Tumbling Aggregate ({WINDOW_SIZE_SECONDS}s)"
    hop_label = f"Hopping Aggregate ({WINDOW_SIZE_SECONDS}s / {HOPPING_STEP_SECONDS}s)"
    return {
        "status": "active",
        "pipeline": {
            "app_id": APP_ID,
            "window_size_seconds": WINDOW_SIZE_SECONDS,
            "hopping_step_seconds": HOPPING_STEP_SECONDS,
        },
        "dag": {
            "nodes": [
                {"id": "ingest", "label": "Kafka Ingest (truck-telemetry)", "type": "input"},
                {"id": "dedup", "label": "Deduplication", "type": "process"},
                {"id": "filter", "label": "Temperature Filter (>0°C)", "type": "process"},
                {"id": "map", "label": "Normalize Event", "type": "process"},
                {"id": "tumbling", "label": tumble_label, "type": "window"},
                {"id": "hopping", "label": hop_label, "type": "window"},
                {"id": "state", "label": "Faust State Tables", "type": "storage"},
                {"id": "changelog", "label": "Changelog (recovery demos)", "type": "storage"},
                {"id": "sink", "label": "Kafka Output (truck-averages)", "type": "output"},
            ],
            "edges": [
                {"source": "ingest", "target": "dedup"},
                {"source": "dedup", "target": "filter"},
                {"source": "filter", "target": "map"},
                {"source": "map", "target": "tumbling"},
                {"source": "map", "target": "hopping"},
                {"source": "tumbling", "target": "state"},
                {"source": "hopping", "target": "state"},
                {"source": "tumbling", "target": "sink"},
                {"source": "hopping", "target": "sink"},
            ],
        },
    }

@app.get("/api/status")
def api_status():
    workers = worker_manager.get_status()
    stack = build_stack_status(workers)
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "kafka_consumer": "connected" if state.kafka_connected else "disconnected",
        "pipeline": {
            "app_id": APP_ID,
            "window_size_seconds": WINDOW_SIZE_SECONDS,
            "hopping_step_seconds": HOPPING_STEP_SECONDS,
            "demo_mode": os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes"),
        },
        **stack,
    }

@app.get("/api/workers")
def get_workers():
    return worker_manager.get_status()

@app.post("/api/workers/{worker_id}/start")
def start_worker(worker_id: str):
    success = worker_manager.start_worker(worker_id)
    return {"success": success, "status": "running" if success else "failed"}

@app.post("/api/workers/{worker_id}/kill")
def kill_worker(worker_id: str):
    success = worker_manager.kill_worker(worker_id)
    return {"success": success, "status": "stopped"}

@app.on_event("shutdown")
def on_shutdown():
    logger.info("API shutting down, killing all worker processes...")
    worker_manager.shutdown_all()

# WebSocket telemetry server
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.active_connections.add(websocket)
    logger.info("New WebSocket connection registered. Total active: %d", len(state.active_connections))
    
    # Send initial status
    try:
        initial_frame = {
            "type": "init",
            "data": state.get_snapshot(),
            "workers": worker_manager.get_status()
        }
        await websocket.send_json(initial_frame)
        
        while True:
            # Keep connection open, handle client messages if any
            data = await websocket.receive_text()
            logger.debug("Received websocket client packet: %s", data)
    except WebSocketDisconnect:
        state.active_connections.discard(websocket)
        logger.info("WebSocket disconnected. Total active: %d", len(state.active_connections))
    except Exception as e:
        logger.error("WebSocket exception: %s", e)
        state.active_connections.discard(websocket)
