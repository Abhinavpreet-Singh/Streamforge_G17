"""
StreamForge Topology & Telemetry API
Exposes endpoints for:
  - WebSocket live telemetry feeds (/ws/live)
  - Worker subprocess management (start, kill, status)
  - Topology metadata (/topology)
  - Prometheus metrics (/metrics)
  - Health check (/health)
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
        self.ingestion_rate = 0.0
        self.filter_rate = 0.0
        self.message_times = []  # timestamps of processed messages in last 5s
        self.recent_readings = []  # List[dict] max 50
        self.trucks: Dict[int, dict] = {}  # truck_id -> latest telemetry/aggregates
        self.anomalies = []  # List[dict] max 50
        self.active_connections: Set[WebSocket] = set()

    def add_reading(self, reading: dict):
        with self.lock:
            self.total_readings += 1
            truck_id = reading.get("truck_id")
            temp = reading.get("temperature")
            ts = reading.get("timestamp")
            fuel = reading.get("fuel_level")
            
            # Record time for rate calculations
            self.message_times.append(time_now_seconds())
            
            # Update truck baseline
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

            # Anomaly detection (e.g. temperature threshold or z-score alert)
            # Normal baseline temp is 30-40, let's flag > 42 as anomaly for demo visual impact
            if temp > 42.0:
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

            # Keep recent readings bounded
            self.recent_readings.append(reading)
            if len(self.recent_readings) > 50:
                self.recent_readings.pop(0)

    def add_aggregate(self, aggregate: dict):
        with self.lock:
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

    def update_rates(self):
        with self.lock:
            now = time_now_seconds()
            # Retain only timestamps from the last 5 seconds
            self.message_times = [t for t in self.message_times if now - t <= 5.0]
            count = len(self.message_times)
            self.ingestion_rate = round(count / 5.0, 2)
            
            # Simple simulation of filter rate
            self.filter_rate = round(self.ingestion_rate * 0.05, 2)  # roughly 5% get filtered

    def get_snapshot(self) -> dict:
        with self.lock:
            # Sort trucks by ID to keep layout consistent
            sorted_trucks = sorted(self.trucks.values(), key=lambda t: t["truck_id"])
            return {
                "total_readings": self.total_readings,
                "ingestion_rate": self.ingestion_rate,
                "filter_rate": self.filter_rate,
                "recent_readings": list(reversed(self.recent_readings))[:20],
                "trucks": sorted_trucks[:100],  # cap at 100 for network performance
                "anomalies": list(reversed(self.anomalies))[:15],
            }

def time_now_seconds() -> float:
    return datetime.now(timezone.utc).timestamp()

state = TelemetryState()

# Worker Manager class
class WorkerManager:
    def __init__(self):
        self.workers = {
            "worker-1": {"proc": None, "port": 6066, "status": "stopped", "pid": None},
            "worker-2": {"proc": None, "port": 6067, "status": "stopped", "pid": None}
        }
        self.lock = threading.Lock()

    def start_worker(self, name: str) -> bool:
        with self.lock:
            if name not in self.workers:
                return False
            
            if self.workers[name]["status"] == "running":
                return True

            logger.info("Spawning worker subprocess for %s...", name)
            
            # Subprocess paths and arguments
            python_exe = REPO_ROOT / ".venv" / "Scripts" / "python.exe"
            if not python_exe.exists():
                python_exe = "python" # fallback to system python
                
            cmd = [
                str(python_exe), "-m", "src.stream_processor.topology",
                "worker", 
                "-l", "info", 
                "--without-web"
            ]
            
            # Log output to file
            log_dir = REPO_ROOT / "logs"
            log_dir.mkdir(exist_ok=True)
            log_file = open(log_dir / f"{name}.log", "a")
            
            # Start process
            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(REPO_ROOT),
                    stdout=log_file,
                    stderr=log_file,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
                )
                self.workers[name]["proc"] = proc
                self.workers[name]["pid"] = proc.pid
                self.workers[name]["status"] = "running"
                logger.info("Worker %s successfully started with PID %d", name, proc.pid)
                return True
            except Exception as e:
                logger.error("Failed to start worker %s: %s", name, e)
                return False

    def kill_worker(self, name: str) -> bool:
        with self.lock:
            if name not in self.workers:
                return False
            
            w = self.workers[name]
            proc = w["proc"]
            
            if proc is not None:
                logger.warning("Killing worker %s (PID %d)...", name, w["pid"])
                try:
                    # Abrupt SIGKILL (terminate and kill)
                    proc.kill()
                    proc.wait(timeout=2.0)
                except Exception as e:
                    logger.error("Error waiting for worker kill: %s", e)
                w["proc"] = None
                w["pid"] = None
                
            w["status"] = "stopped"
            
            # Simulate total disk loss for RocksDB local cache
            # Faust data is located in streamforge-data/
            # We delete the specific worker state subfolder to force Kafka changelog restore
            data_dir = REPO_ROOT / "streamforge-data"
            if data_dir.exists():
                logger.info("Deleting local cache directory to force changelog restore on next boot")
                try:
                    # Clean up local rocksdb files for the app
                    shutil.rmtree(data_dir, ignore_errors=True)
                except Exception as e:
                    logger.error("Failed to delete local state cache: %s", e)
                    
            logger.info("Worker %s is terminated", name)
            return True

    def get_status(self) -> List[dict]:
        with self.lock:
            status_list = []
            for name, w in self.workers.items():
                proc = w["proc"]
                # Verify if still running
                if proc is not None:
                    if proc.poll() is not None:
                        # Process terminated on its own
                        w["status"] = "stopped"
                        w["pid"] = None
                        w["proc"] = None
                
                status_list.append({
                    "id": name,
                    "status": w["status"],
                    "pid": w["pid"],
                    "port": w["port"],
                    "partitions": "0-9" if name == "worker-1" else "10-19" # split partitions
                })
            return status_list

    def shutdown_all(self):
        for name in list(self.workers.keys()):
            self.kill_worker(name)

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
    return {
        "status": "active",
        "dag": {
            "nodes": [
                {"id": "ingest", "label": "Kafka Ingest (truck-telemetry)", "type": "input"},
                {"id": "dedup", "label": "Deduplication", "type": "process"},
                {"id": "filter", "label": "Temperature Filter (>0°C)", "type": "process"},
                {"id": "map", "label": "Normalize Event", "type": "process"},
                {"id": "tumbling", "label": "Tumbling Aggregate (5m)", "type": "window"},
                {"id": "hopping", "label": "Hopping Aggregate (5m/1m)", "type": "window"},
                {"id": "rocksdb", "label": "RocksDB Cache", "type": "storage"},
                {"id": "changelog", "label": "Kafka Changelog (truck-state-changelog)", "type": "storage"},
                {"id": "sink", "label": "Kafka Output (truck-averages)", "type": "output"}
            ],
            "edges": [
                {"source": "ingest", "target": "dedup"},
                {"source": "dedup", "target": "filter"},
                {"source": "filter", "target": "map"},
                {"source": "map", "target": "tumbling"},
                {"source": "map", "target": "hopping"},
                {"source": "tumbling", "target": "rocksdb"},
                {"source": "hopping", "target": "rocksdb"},
                {"source": "rocksdb", "target": "changelog"},
                {"source": "tumbling", "target": "sink"},
                {"source": "hopping", "target": "sink"}
            ]
        }
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
