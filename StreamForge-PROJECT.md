# StreamForge — Distributed Python Event Processor

**Axlero Solutions Intern Project · Team of 6 · Month 1 (Project 1 of 2)**
Domain: Distributed Systems & Big Data — built on Kafka + Faust/Bytewax + RocksDB + FastAPI + React Flow.

A pure-Python streaming engine that ingests IoT truck telemetry from a simulated fleet of 50,000 trucks,
computes windowed rolling averages per truck across 20 parallel workers, and survives worker crashes
with zero data loss (state recovered from a RocksDB changelog).

---

## 1. Team & Ownership

Six people, one branch each. Lead merges to `main`. Credits below match **git commits / files**, not the Week-1 template.

| Member | Branch | Shipped (from git) |
|---|---|---|
| Abhinavpreet Singh Arora (Lead) | `Abhinavpreet` | Docker/Kafka, producer + Avro, RocksDB + chaos/load scripts, API/UI integration, Pipeline, Grafana |
| Meven Regi | `Meven` | Faust topology — config, models, dedup → filter → map → windows |
| Noore Simin | `Noore` | React scaffold, throughput chart, Fleet page, `validator.py` + tests |
| Shifana Parveen R | `shifana` | FastAPI `/metrics`, `/topology`, stack health; Operations + ChaosPanel |
| Surya Sankar | `Surya` | Metrics page — rates, StatCards, refresh, raw `/metrics` |
| Raghavendra | `Raghavendra` | 50k-truck CSV dataset |

Planned week-by-week roles: [WORK_DISTRIBUTION.md](WORK_DISTRIBUTION.md).

## 2. Repo & Branching Strategy

```
main                  ← protected, integration branch, Lead-only merges
├── Abhinavpreet       (Lead)
├── Meven               \
├── Noore                 } one branch per remaining member,
├── Raghavendra            } role assigned per §1 above
├── Shifana               /
└── Surya
```

Workflow: work on your branch → open a PR into `main` at the end of each week → Lead reviews & merges
before the next week's tasks start. This keeps `main` always demo-able for reviews.

**GitHub compliance (team-wide, tracked on the shared repo):**
- **Mid Review window (23rd–30th):** commits on ≥10 different days in the prior 14 days.
- **Final Review window (7th–15th of next month):** commits on all 20 of the prior 20 days, no gaps.
- Commits can come from any member — it's a collective requirement, not per-person.

## 3. Environment Setup

```bash
# 1. Clone / unzip, then from the project root:
bash scripts/setup.sh          # creates venv, installs deps, brings up local infra

# 2. Or manually:
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
docker-compose up -d           # Kafka, Zookeeper, Schema Registry, Kafka UI, Prometheus, Grafana
```

Local infra once running:
- Kafka broker: `localhost:9092`
- Kafka UI (browse topics/partitions): `localhost:8080`
- Schema Registry: `localhost:8081`
- Prometheus: `localhost:9090`
- Grafana: `localhost:3001`

## 4. Week-wise Plan (mapped to owners)

RocksDB / state-recovery work is folded into Stream Processing (Week 3) rather than kept as a
standalone role — see [WORK_DISTRIBUTION.md](WORK_DISTRIBUTION.md) for the full rationale.

| Week | Stream Processing | Data Simulation & Validation | Frontend | Docs/Testing/Chaos | Backend API | Lead |
|---|---|---|---|---|---|---|
| 1 | Faust/Bytewax app skeleton, consumer prints raw messages | 50k-truck synthetic dataset (pandas/numpy/faker) | React + React Flow scaffold, static DAG boxes | Architecture/workflow/team diagrams | FastAPI scaffold, `/health` | Docker-compose stack up, Kafka topics created, producer implemented |
| 2 | Consume → Filter(temp>0) → Map; tumbling/hopping windows | Validation scripts (expected vs. system average) | — | Test cases (valid/invalid temp, missing truck ID, late data) | `/metrics`, `/topology` | Register Avro schema in Schema Registry |
| **Mid Review** | Prove 100k events/sec across partitions | Confirm dataset + validation outputs match system | — | — | — | Confirm 10/14-day commit rule met |
| 3 | Wire output into RocksDB changelog topic; chaos test (kill a worker, prove recovery) | Recovery verification (pre/post-crash average comparison) | Live telemetry dashboard components | Chaos-testing scripts (kill/restart worker), results documented | `/ws/live` WebSocket | Integration pass across branches |
| 4 | Performance tuning, throughput audit | Benchmark report + charts | Wire metrics into React Flow, polish UI | Demo script, review deck | Backend↔frontend integration | Demo prep, merge freeze |
| **Final Review** | — | — | — | — | — | Confirm 20/20-day commit rule met, full demo |

## 5. Definition of Done

- **Mid Review:** local Kafka cluster running, producer streaming mock data, Faust/Bytewax topology
  consuming + windowing correctly, throughput audit passed (100k events/sec).
- **Final Review:** RocksDB-backed recovery survives a killed worker with no lost/duplicated readings,
  Prometheus metrics flowing into the React Flow dashboard, end-to-end demo works from producer to UI.

### 5.1 Throughput audit — measured results

Run with `python scripts/load_test_producer.py 20 10000 --workers 10`
(8-core dev machine, single-broker local Kafka, 20 partitions):

| Configuration | Events/sec | Verdict |
|---|---|---|
| 10 worker processes, validation off | **111,968** | PASS (target: 100,000) |
| 10 worker processes, validation on | 66,150 | Below target |
| 1 process, validation on | 12,533 | Below target |

Two things this measurement establishes:

- **Multiprocessing is what gets us there, not tuning.** A single process tops out around 12k
  events/sec — the bottleneck is CPU-bound JSON encoding in a GIL-bound loop, so threads wouldn't
  help. Throughput scales with process count until cores run out.
- **Per-message Avro validation costs ~41% throughput** (112k → 66k). The correctness path
  (`src/producer/truck_producer.py`) validates every message and is proven separately, so the
  load-test path leaves validation off by default — otherwise the audit measures `fastavro`
  rather than the pipeline. Pass `--validate` to reproduce the slower number.

### 5.2 Crash-recovery audit — measured results

Run with `python scripts/chaos_recovery_demo.py 20 5` (requires the stack up and
`bash scripts/create_topics.sh` to have created `truck-state-changelog`):

```
[1] worker A ingesting 20 readings x 5 trucks...
[2] killing worker A mid-calculation (no flush, local state destroyed)...
[3] worker B starting empty, replaying changelog from Kafka...
    read 100 changelog records / restored 5 truck states
PASSED: all 5 truck states recovered exactly, zero data loss
```

The test is deliberately harsher than a graceful restart: worker A is dropped
without `checkpoint()` or `close()`, and its RocksDB directory is deleted — the
worst case, a replacement landing on a fresh node after a rebalance. Worker B
starts empty and rebuilds purely from Kafka.

Design notes that make this hold:

- **RocksDB is a local cache; the changelog is the source of truth.** A worker
  that keeps its disk reads locally; one that lost it replays. Both converge on
  identical state.
- **Writes go to RocksDB first, then the changelog.** A crash between the two
  replays a stale-but-correct value rather than inventing state that never
  existed locally — worst case costs one reading, never a corrupt total.
- **Replay is idempotent** (covered by `test_changelog_replay_is_idempotent`):
  records are last-write-wins per key, so at-least-once changelog delivery
  can't double-count.
- **The changelog topic is log-compacted**, so replay time stays bounded by
  truck count rather than growing with total readings.

## 6. Uniqueness / Portfolio Differentiators

The base spec (Kafka + Faust + RocksDB + a dashboard) is already solid, but these push it past a
generic "streaming CRUD" demo:

- **Exactly-once, provably.** Idempotent + transactional Kafka producer/consumer, with a test that
  intentionally double-sends a batch and shows the sink never double-counts.
- **Schema Registry + Avro contracts.** Real data governance instead of raw JSON — includes a schema
  evolution demo (add a field, prove old consumers don't break).
- **Live chaos-engineering console.** A button in the dashboard that kills/revives a worker process on
  demand, with the partition rebalance and state recovery visible in real time on the DAG view —
  turns the SOP's required "chaos testing" into an actual product feature, not just a one-off script.
- **Digital fleet twin.** Instead of a plain line chart, a live map (Leaflet) plotting simulated truck
  positions with a heat overlay for temperature anomalies (z-score based alerting) — makes the demo
  visual and immediately legible to non-technical reviewers.
- **Time-travel replay.** Replay any Kafka topic from a given offset/timestamp to reconstruct exactly
  what state looked like at that moment — useful for debugging and a nice "wow" feature in a demo.
- **Multi-tenant isolation.** Two simulated fleet operators sharing the same cluster via topic-per-tenant
  with ACL isolation, proving the design holds up beyond a single-customer toy example.

Not all of these need to ship in Month 1 — treat them as a backlog to pull from once the core
pipeline (Weeks 1–4 above) is solid, roughly in the order listed.

## 7. Project Structure

```
streamforge/
├── README.md                  ← this file
├── WORK_DISTRIBUTION.md        ← submit before Mid Review per SOP §9.10
├── requirements.txt
├── docker-compose.yml
├── .gitignore
├── scripts/setup.sh
├── infra/prometheus.yml
├── src/
│   ├── producer/truck_producer.py       (Lead)
│   ├── stream_processor/topology.py     (Stream Processing)
│   ├── state_store/rocksdb_store.py     (Stream Processing, Week 3)
│   ├── api/main.py                      (Backend API)
│   └── metrics/                         (Backend API)
├── datasets/                            (Data Simulation & Validation — Week 1 CSV output)
├── analytics/                           (Data Simulation & Validation — Week 2-4 validation/benchmarks)
├── frontend/README.md                   (Frontend)
├── tests/
└── docs/architecture.md                 (Docs/Testing/Chaos)
```
