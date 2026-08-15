# StreamForge

**Axlero Solutions · G17 · Distributed Python Event Processor**

Simulated truck fleet telemetry → Kafka → Faust stream processing → windowed per-truck averages → live React operations console.

---

## What it does

StreamForge models a **distributed IoT pipeline**: thousands of virtual trucks emit temperature readings into Kafka. A Faust worker deduplicates, filters, and aggregates those readings in **tumbling and hopping windows**, then publishes per-truck averages to a sink topic. A FastAPI layer streams live state to a React dashboard where you can watch throughput, inspect the pipeline DAG, map the fleet, crash the processor, and open embedded Grafana charts.

```
Producer → truck-telemetry → Faust (dedup → filter → map → windows) → truck-averages
                                                              ↓
                                    FastAPI + WebSocket → React dashboard
```

---

## What makes it unique

- **Dual windowing** — tumbling and hopping averages per truck, visible on the fleet map and in live metrics
- **Live pipeline DAG** — React Flow graph with per-stage rates (ingestion, dedup drops, filter, sink) updating over WebSocket
- **Chaos from the UI** — start or crash the Faust worker from the Operations page; state wipe + Kafka replay demo
- **Observability inside the app** — Grafana/Prometheus embeds on Metrics, `streamforge_*` gauges, alert rules
- **Proven throughput** — ~111k events/sec measured via `load_test_producer.py`
- **Recovery story** — RocksDB dual-write + changelog in the live path; UI chaos wipe + `chaos_recovery_demo.py`
- **Schema-safe ingest** — Avro-validated producer (temp, fuel, GPS) with Schema Registry; 50k-truck dataset

---

## Features

| Area | Capability |
| --- | --- |
| **Ingest** | Idempotent truck producer, Avro (temp/fuel/GPS), demo mode (100 trucks / fast windows) |
| **Processing** | Faust topology: dedup → filter (>0°C) → map → tumbling + hopping → sink + RocksDB dual-write |
| **API** | `/health`, `/topology`, `/metrics`, `/api/status` (lag), worker start/kill/logs, WebSocket |
| **Dashboard** | Overview, Fleet, Pipeline, Operations, Metrics (Grafana/Prom embed) |
| **Charts** | 60-second rolling throughput chart (ingestion vs filtered) |
| **Ops** | Docker stack: Kafka, Schema Registry, Kafka UI, Prometheus (+alerts), Grafana |
| **Data** | 50k-truck synthetic CSV + `validate_dataset.py` |
| **Testing** | Pytest suite, stack health check, load test, chaos and exactly-once demos |

---

## Tech stack

**Messaging & data**

[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Confluent](https://img.shields.io/badge/Schema_Registry-000000?style=flat-square&logo=confluent&logoColor=white)](https://docs.confluent.io/platform/current/schema-registry/index.html)
[![Avro](https://img.shields.io/badge/Avro-2481FF?style=flat-square)](https://avro.apache.org/)

**Stream processing & storage**

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Faust](https://img.shields.io/badge/Faust-streaming-2E3440?style=flat-square&logo=python&logoColor=white)](https://faust.readthedocs.io/)
[![RocksDB](https://img.shields.io/badge/RocksDB-2E3440?style=flat-square)](https://rocksdb.org/)

**API & observability**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-F46800?style=flat-square&logo=grafana&logoColor=white)](https://grafana.com/)

**Frontend**

[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Recharts](https://img.shields.io/badge/Recharts-22B5C4?style=flat-square)](https://recharts.org/)

**Infrastructure**

[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![pytest](https://img.shields.io/badge/pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white)](https://pytest.org/)

---

## Quick start

```powershell
py -3.12 -m venv .venv && .\.venv\Scripts\activate
pip install -r requirements.txt
docker compose up -d
bash scripts/create_topics.sh && python scripts/register_schema.py
cd frontend && npm install && cd ..
```

**Run the demo** (three terminals + Docker):

```powershell
$env:DEMO_MODE = "1"
python -m src.producer.truck_producer
uvicorn src.api.main:app --reload --port 8000
cd frontend && npm run dev
```

Open http://localhost:5173 → **Operations** → **Start** stream processor.

| Service | URL |
| --- | --- |
| Dashboard | http://localhost:5173 |
| API | http://localhost:8000 |
| Kafka UI | http://localhost:8080 |
| Grafana | http://localhost:3001 (`admin` / `admin`) |
| Prometheus | http://localhost:9090 |

Helper: `.\scripts\run_demo.ps1` · Architecture: [docs/architecture.md](docs/architecture.md) · Observability check: `python scripts/verify_observability.py`

---

## Team

Credits follow git history (commits + files touched), not the original role sheet.

| Member | What they shipped |
| --- | --- |
| **Abhinavpreet Singh Arora** (Lead) | Docker/Kafka stack, producer + Avro, RocksDB + chaos/load demos, API/UI integration, Pipeline page, Grafana, merges |
| **Meven Regi** | Faust app — topics, models, topology (dedup → filter → map → tumbling/hopping) |
| **Noore Simin** | React app scaffold, live throughput chart, Fleet page (map + table), message validator + tests |
| **Shifana Parveen R** | FastAPI `/metrics`, `/topology`, stack health; Operations page + ChaosPanel |
| **Surya Sankar** | Metrics page — live rates, StatCards, auto-refresh, raw `/metrics` panel |
| **Raghavendra** | 50k-truck synthetic dataset (`datasets/truck_data.csv`) |

---

*Axlero Solutions · G17 Intern Project · Month 1*
