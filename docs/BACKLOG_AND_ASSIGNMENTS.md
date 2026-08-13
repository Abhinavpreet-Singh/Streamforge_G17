# Backlog & Team Assignments — StreamForge

What is **done**, what is **left**. Use for mid-review demos.

## Quick status

| Area | Status | Notes |
| --- | --- | --- |
| Kafka + Schema Registry + Kafka UI | Done | `docker compose up -d` |
| Producer → `truck-telemetry` | Done | Demo mode + fuel/GPS fields |
| Faust topology | Done | Dedup → filter → map → windows |
| RocksDB dual-write (live) | Done | Rolling averages → changelog; Faust tables remain primary windows |
| Sink → API → WebSocket | Done | Live dashboard |
| React pages (all 5) | Done | Overview, Fleet, Pipeline, Operations, Metrics |
| `/api/status` + consumer lag | Done | Partition lag for Faust group |
| Prometheus + Grafana | Done | `streamforge_*` gauges + provisioned dashboard + alerts |
| Worker logs in UI | Done | Operations panel |
| Load test script | Done | Formal write-up optional |
| Multi-tenant / replay | Backlog | Future work |

## Verify Prometheus & Grafana

1. `docker compose up -d`
2. `uvicorn src.api.main:app --host 0.0.0.0 --port 8000`
3. Producer + Start processor from Operations
4. `python scripts/verify_observability.py`
5. Grafana → **StreamForge API** (`admin` / `admin`)

## Suggested demo order (5 min)

1. `docker compose up -d` → Kafka UI :8080
2. Producer + API + `npm run dev`
3. **Operations → Start** → sink rate & chart move
4. **Metrics** → Grafana embed / Prometheus
5. **Crash** → wipe → **Start** → recover
6. Mention load test script (~111k msg/s)

See [WORK_DISTRIBUTION.md](./WORK_DISTRIBUTION.md) for original Week 1–4 plan.
