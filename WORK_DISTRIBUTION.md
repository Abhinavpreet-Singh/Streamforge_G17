# Work Distribution Document — StreamForge (Month 1, Project 1)

Per Axlero Solutions SOP §9.10, submitted for Mid Review.

Team of 6 — roles assigned by skill fit. Every member commits on their own branch; Lead merges to `main`.

| Member | Branch | Role | Week 1 | Week 2 | Week 3 | Week 4 |
| --- | --- | --- | --- | --- | --- | --- |
| Abhinavpreet Singh Arora (Lead) | `Abhinavpreet` | Kafka Foundation & Integration | Docker-compose, topics, producer ✓ | Avro schema ✓ | Integration merges ✓ | Demo prep, merge freeze |
| Meven Regi | `Meven` | Stream Processing | Faust skeleton ✓ | Filter→Map, windowing ✓ | Topology + consumer wiring ✓ | Throughput tuning |
| Raghavendra | `Raghavendra` | Data Simulation & Validation | 50k-truck dataset ✓ | `validate_dataset.py` ✓ | Recovery scripts ✓ | Benchmark / validation report |
| Noore Simin | `Noore` | Frontend Dashboard | React + React Flow scaffold ✓ | Dashboard components ✓ | Live telemetry + throughput chart ✓ | UI polish ✓ |
| Shifana | `shifana` | Backend API & Observability | FastAPI `/health` ✓ | `/metrics`, `/topology` ✓ | WebSocket `/ws/live` ✓ | `/api/status`, stack health |
| Surya | `Surya` | Docs, Testing & Chaos | Architecture diagrams ✓ | Validator tests ✓ | `chaos_recovery_demo.py` ✓ | Demo scripts (`run_demo.ps1`) |

**Shipped (git, not the plan):** Lead — stack, producer, RocksDB/chaos/load, integration. Meven — Faust topology. Noore — React scaffold, chart, Fleet, validator. Shifana — FastAPI metrics/topology/status, Operations/Chaos. Surya — Metrics page. Raghavendra — 50k CSV.

## Distribution Rationale

- Stream Processing and Backend API go to the strongest coders after the Lead.
- Data Simulation is self-contained (pandas/CSV) — good for validation without deep Kafka work.
- Frontend and chaos/docs are demo-critical for reviewers.
- RocksDB recovery is folded into Stream Processing Week 3 + Lead deliverables (`chaos_recovery_demo`, state store tests).

**Revision rule:** 48+ hour unresponsive → reassign per SOP §6 and log below.

## Reassignment Log

_(none)_

## Next sprint

See **[docs/BACKLOG_AND_ASSIGNMENTS.md](./docs/BACKLOG_AND_ASSIGNMENTS.md)** for per-person tasks, Prometheus/Grafana verification, and remaining frontend/backend work.
