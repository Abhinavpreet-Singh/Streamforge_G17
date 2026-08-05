# Backlog & Team Assignments — StreamForge

What is **done**, what is **left**, and who should own the next slice. Use this for Week 4+ and mid-review demos.

## Quick status (as of latest integration)

| Area | Status | Notes |
| --- | --- | --- |
| Kafka + Schema Registry + Kafka UI | Done | `docker compose up -d` |
| Producer → `truck-telemetry` | Done | Demo mode: 100 trucks, 2s |
| Faust topology (dedup → filter → map → windows) | Done | Single `stream-processor` worker |
| Sink `truck-averages` → API → WebSocket | Done | Live dashboard |
| React dashboard (map, DAG, chaos, throughput chart) | Done | Map uses **simulated** US routes |
| `/api/status`, stack health | Done | Kafka + registry + workers |
| Prometheus `/metrics` | **Improved** | Gauges for rates, trucks, workers, Kafka |
| Grafana dashboard | **Improved** | `http://localhost:3001/d/streamforge-api` |
| RocksDB changelog in **live** Faust path | **Not done** | Proven only in `chaos_recovery_demo.py` |
| Real GPS on map | **Not done** | Avro v2 has lat/lng; producer does not emit |
| Load test 100k+ msg/s report | Partial | Script exists; formal write-up optional |
| Multi-tenant / replay | Backlog | README future work |

## Verify Prometheus & Grafana

1. Start stack: `docker compose up -d` (includes prometheus + grafana).
2. Start API: `uvicorn src.api.main:app --host 0.0.0.0 --port 8000`
3. Start producer + stream processor (dashboard **Start** or API).
4. Run: `python scripts/verify_observability.py`
5. Open Grafana → **StreamForge API** dashboard (admin / admin).
6. Prometheus targets: `http://localhost:9090/targets` — `streamforge-api` should be **UP**.

Prometheus scrapes `host.docker.internal:8000/metrics` (API on the host). Dashboard header links: **Grafana** / **Prometheus**.

---

## Assignments by person

### Abhinavpreet (Lead) — integration & demo owner

- [ ] Merge observability + assignment docs to `main` after review
- [ ] Own end-to-end demo script (`scripts/run_demo.ps1`) and mid-review walkthrough
- [ ] Wire **optional** India fleet map toggle (env or UI) if pitching locally
- [ ] Final merge freeze + tag release for Axlero review

### Meven — stream processing

- [ ] **Wire RocksDB changelog into live Faust topology** (biggest technical gap)
- [ ] Expose Faust table sizes / window lag as logs or a small metrics topic
- [ ] Tune window sizes for stable sink rate under demo load
- [ ] Document recovery story: crash → state wipe → replay behavior

### Noore Simin — frontend

- [x] Throughput chart (60s rolling) — merged
- [ ] Truck detail drawer: tumbling vs hopping averages side-by-side
- [ ] Anomaly list: click → focus truck on map
- [ ] Dark mode / responsive layout for projector demo
- [ ] Empty states when processor stopped (clearer CTA)

### Shifana — API & observability

- [x] `/metrics`, `/topology`, WebSocket — base done
- [ ] **Consumer lag** on `/api/status` (per topic partition)
- [ ] Faust worker stdout tail endpoint or log viewer in UI (read-only)
- [ ] Extend Prometheus with histogram for WS broadcast latency
- [ ] Alert rules file (`infra/prometheus/alerts.yml`) — optional stretch

### Raghavendra — data & validation

- [ ] Compare `validate_dataset.py` output vs live pipeline aggregates (automated diff)
- [ ] One-page **benchmark report**: 50k dataset + load test numbers, graphs
- [ ] Add `fuel_level` to Avro v1 or document why omitted
- [ ] CI job: run validator on PR

### Surya — docs, tests, chaos

- [ ] Keep `docs/architecture.md` in sync with single-worker reality
- [ ] Expand pytest for `/api/status` and metrics smoke test
- [ ] Chaos runbook: producer on → crash worker → restart → expected recovery
- [ ] `verify_observability.py` in README quickstart

---

## Frontend — what’s left (summary)

| Item | Priority | Owner |
| --- | --- | --- |
| Real GPS from Kafka (not simulated map) | High | Simin + Meven (schema + UI) |
| Truck click / anomaly navigation | Medium | Simin |
| Processor log panel | Medium | Shifana + Simin |
| Grafana embed or screenshot panel | Low | Shifana |
| Mobile / projector layout | Low | Simin |

## Backend — what’s left (summary)

| Item | Priority | Owner |
| --- | --- | --- |
| RocksDB in live Faust | High | Meven |
| Consumer lag metrics | Medium | Shifana |
| Avro v2 + lat/lng in producer | Medium | Lead + Raghavendra |
| Prometheus alert rules | Low | Shifana |

## Suggested demo order (5 min)

1. `docker compose up -d` → Kafka UI :8080
2. Producer + API + `npm run dev` → dashboard live
3. **Start** stream processor → sink rate & throughput chart move
4. Open **Grafana** → show ingestion + sink panels
5. **Crash** worker → state wipe → restart → numbers recover
6. Mention 111k msg/s load test (script, not live)

---

See also [WORK_DISTRIBUTION.md](./WORK_DISTRIBUTION.md) for original Week 1–4 plan.
