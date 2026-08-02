# StreamForge

**Axlero Solutions · G17 · Distributed Python Event Processor**

Simulated IoT fleet → Kafka → Faust topology → windowed per-truck averages → live React dashboard. RocksDB + changelog recovery proven in chaos demos.

`main` · integrated · 111k events/sec measured

---

## Tech Stack

Kafka · Faust · RocksDB · Avro/Schema Registry · FastAPI · WebSockets · Prometheus · Grafana · React · Vite · Tailwind · React Flow · Leaflet · Recharts

---

## Features (shipped)

| Area | Delivered |
| --- | --- |
| Ingest | Idempotent Avro-validated producer (`truck-telemetry`) |
| Processing | Dedup → filter → map → tumbling + hopping windows |
| Recovery | RocksDB changelog demo, exactly-once proof, chaos scripts |
| Performance | 111k+ evt/s load test |
| API | `/health`, `/topology`, `/metrics`, `/api/status`, `/ws/live`, worker control |
| Dashboard | Fleet map, live DAG, **60s throughput chart**, chaos panel, stack health |
| Data | 50k-truck CSV + `validate_dataset.py` |
| Ops | Docker stack, Grafana dashboard, `check_stack.py`, `run_demo.ps1` |

---

## Team

| Member | GitHub | Contributions |
| --- | --- | --- |
| Abhinavpreet Singh Arora | Abhinavpreet | Lead · producer · RocksDB · API · merges |
| Meven Regi | Meven | Faust topology · consumer wiring |
| Noore Simin | nooresimin2005 | Dashboard · validator |
| Shifana | Shifana14-d | `/topology` · `/metrics` |
| Raghavendra | kraghavendra2500-code | 50k dataset |

---

## Setup

```bash
py -3.12 -m venv .venv && .\.venv\Scripts\activate
pip install -r requirements.txt
docker compose up -d
bash scripts/create_topics.sh
python scripts/register_schema.py
```

| Service | URL |
| --- | --- |
| Dashboard | http://localhost:5173 |
| API | http://localhost:8000 |
| Kafka UI | http://localhost:8080 |
| Grafana | http://localhost:3001 (admin / admin) |
| Prometheus | http://localhost:9090 |

---

## Demo (3 terminals)

```powershell
$env:DEMO_MODE = "1"

# 1 — producer
python -m src.producer.truck_producer

# 2 — API
uvicorn src.api.main:app --reload --port 8000

# 3 — UI (proxies API + WebSocket)
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 → **Start** stream processor → watch throughput chart, map, and DAG.

---

## Verify

```bash
python scripts/check_stack.py
python scripts/validate_dataset.py
pytest tests/ -q
python scripts/load_test_producer.py 20 10000 --workers 10
python scripts/chaos_recovery_demo.py 20 5
python scripts/exactly_once_demo.py
```

---

## Structure

```
src/producer/          Kafka ingest
src/stream_processor/  Faust topology
src/state_store/       RocksDB + changelog (demos/tests)
src/api/               FastAPI + WebSocket
frontend/              React dashboard
scripts/               demos, validation, load test
tests/                 pytest
infra/                 Prometheus + Grafana
```

[WORK_DISTRIBUTION.md](WORK_DISTRIBUTION.md) · [docs/architecture.md](docs/architecture.md)
