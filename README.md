# StreamForge

**Axlero Solutions · G17 · Distributed Python Event Processor**

Simulated IoT fleet (50k trucks) → Kafka → Faust stream topology → windowed per-truck averages → RocksDB + changelog recovery → live React dashboard. Survives worker crashes with zero data loss.

`main` · integrated · 111k events/sec measured

---

## Tech Stack

| Layer | Stack |
| --- | --- |
| Streaming | Kafka, Faust, 20 partitions |
| State | RocksDB (`rocksdict`), log-compacted changelog |
| Contracts | Avro + Schema Registry (`fastavro`) |
| API | FastAPI, WebSockets, Prometheus |
| Frontend | React 19, Vite, Tailwind, React Flow, Leaflet |
| Infra | Docker Compose — Kafka, Zookeeper, Schema Registry, Kafka UI, Prometheus, Grafana |
| Runtime | Python 3.12, pytest |

---

## Features (shipped)

- **Kafka ingest** — idempotent producer, Avro-validated telemetry (`truck-telemetry`)
- **Stream DAG** — dedup → filter (temp > 0) → normalize → tumbling (5m) + hopping (5m/1m) windows
- **Exactly-once dedup** — double-send proof; sink counts each reading once
- **RocksDB + changelog** — local cache with Kafka replay; chaos demo passes after kill + disk wipe
- **100k+ evt/s** — multiprocess load test (`111,968` on 10 workers)
- **Schema evolution** — Avro v2 field demo; old consumers stay compatible
- **API** — `/health`, `/topology`, `/metrics`, `/ws/live`, worker start/kill
- **Dashboard** — fleet map (Leaflet), live DAG (React Flow), anomaly feed, chaos panel (crash/restart workers)
- **50k-truck dataset** — synthetic CSV for offline validation

---

## Team

Everyone who has committed to this repo:

| Member | GitHub | Branch | Contributions |
| --- | --- | --- | --- |
| Abhinavpreet Singh Arora | Abhinavpreet | `Abhinavpreet` | Lead · producer · models · RocksDB recovery · load test · exactly-once · dashboard API + WebSocket · merges |
| Meven Regi | Meven | `Meven` | Faust app skeleton · stream-processor schema · consumer wiring |
| Noore Simin | nooresimin2005 | `Noore` | React dashboard · validator + tests |
| Shifana | Shifana14-d | `shifana` | `/topology` · `/metrics` · Faust topology (AdminClient) |
| Raghavendra | kraghavendra2500-code | `Raghavendra` | 50k-truck synthetic dataset |

Branches with no commits yet: `Surya`, `simin-testing`

Workflow: members commit on their branch → PR to `main` → Lead merges.

---

## Setup

Python **3.12** required (`rocksdict` / `confluent-kafka` wheels).

```bash
py -3.12 -m venv .venv && .\.venv\Scripts\activate    # Windows
pip install -r requirements.txt
docker compose up -d
bash scripts/create_topics.sh                         # Git Bash / WSL
```

| Service | URL |
| --- | --- |
| Kafka | `localhost:9092` |
| Kafka UI | http://localhost:8080 |
| Schema Registry | http://localhost:8081 |
| API | http://localhost:8000 |
| Dashboard | http://localhost:5173 |
| Prometheus | http://localhost:9090 |

---

## Run & Verify

```bash
# Tests
pytest tests/ -q

# Pipeline
python -m src.producer.truck_producer                              # ingest
python -m src.stream_processor.topology worker -l info --without-web  # process
uvicorn src.api.main:app --reload --port 8000                      # API

# Audits
python scripts/load_test_producer.py 20 10000 --workers 10         # throughput
python scripts/chaos_recovery_demo.py 20 5                           # crash recovery
python scripts/exactly_once_demo.py                                # dedup proof

# Dashboard
cd frontend && npm install && npm run dev
```

**Demo:** stack up → producer → API → `npm run dev` → start workers from the chaos panel → watch map + DAG via `/ws/live`.

---

## Structure

```
src/producer/          Kafka ingest
src/stream_processor/  Faust topology, transforms, models
src/state_store/       RocksDB + changelog
src/api/               FastAPI + WebSocket
frontend/              React dashboard
scripts/               setup, topics, demos, load test
tests/                 pytest suite
```

Details: [WORK_DISTRIBUTION.md](WORK_DISTRIBUTION.md) · [docs/architecture.md](docs/architecture.md)
