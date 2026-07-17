# StreamForge — Distributed Python Event Processor

**Axlero Solutions Intern Project · Team of 5 · Month 1 (Project 1 of 2)**
Domain: Distributed Systems & Big Data — built on Kafka + Faust/Bytewax +
RocksDB + FastAPI + React Flow.

A pure-Python streaming engine that ingests IoT truck telemetry from a simulated
fleet of 50,000 trucks, computes windowed rolling averages per truck across 20
parallel workers, and survives worker crashes with zero data loss (state
recovered from a RocksDB changelog).

---

## 1. Team & Ownership

| Role                                       | Owner    | Branch                  | Focus                                                      |
| ------------------------------------------ | -------- | ----------------------- | ---------------------------------------------------------- |
| Team Lead — Kafka Foundation & Integration | You      | `dev/lead`              | Cluster setup, producer, Avro schemas, merges, review prep |
| Stream Processing Engineer                 | Member 2 | `dev/stream-processing` | Faust/Bytewax topology, windowing logic                    |
| State & Fault-Tolerance Engineer           | Member 3 | `dev/state-store`       | RocksDB state store, changelog recovery, chaos testing     |
| Backend API & Observability Engineer       | Member 4 | `dev/backend-api`       | FastAPI topology monitor, Prometheus metrics               |
| Frontend/Dashboard Engineer                | Member 5 | `dev/frontend`          | React Flow DAG view, live telemetry dashboard              |

> Branches are pre-created with placeholder names. Once roles are confirmed,
> rename each one to the teammate's actual GitHub handle:
> `git branch -m dev/stream-processing dev/<github-username>` then push with
> `-u`.

Per Axlero SOP: every member commits **directly to their own branch**; the Team
Lead is the only one who merges into `main`. GitHub is mandatory for this
project (no Figma exemption here).

## 2. Repo & Branching Strategy

```
main                  ← protected, integration branch, Lead-only merges
├── dev/lead
├── dev/stream-processing
├── dev/state-store
├── dev/backend-api
└── dev/frontend
```

Workflow: work on your branch → open a PR into `main` at the end of each week →
Lead reviews & merges before the next week's tasks start. This keeps `main`
always demo-able for reviews.

**GitHub compliance (team-wide, tracked on the shared repo):**

- **Mid Review window (23rd–30th):** commits on ≥10 different days in the prior
  14 days.
- **Final Review window (7th–15th of next month):** commits on all 20 of the
  prior 20 days, no gaps.
- Commits can come from any member — it's a collective requirement, not
  per-person.

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

| Week             | Stream Processing (`dev/stream-processing`)              | State & Recovery (`dev/state-store`)                                                   | API/Metrics (`dev/backend-api`)                              | Frontend (`dev/frontend`)               | Lead (`dev/lead`)                                  |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------- |
| 1                | Define Faust/Bytewax app skeleton                        | —                                                                                      | Scaffold FastAPI + `/health`                                 | Scaffold React Flow canvas              | Kafka cluster up, producer blasting mock telemetry |
| 2                | Consume → Filter(temp>0) → Map; tumbling/hopping windows | —                                                                                      | —                                                            | —                                       | Register Avro schema in Schema Registry            |
| **Mid Review**   | Prove 100k events/sec across partitions                  | Verify 5-min rolling avg correctness incl. late data                                   | —                                                            | —                                       | Confirm 10/14-day commit rule met                  |
| 3                | Wire output into changelog topic                         | Implement RocksDB store + changelog backup; chaos test (kill a worker, prove recovery) | —                                                            | Telemetry dashboard components          | Integration pass                                   |
| 4                | —                                                        | —                                                                                      | `/metrics`, `/topology`, `/ws/live` (Prometheus + WebSocket) | Wire metrics into React Flow, polish UI | Demo prep, merge freeze                            |
| **Final Review** | —                                                        | —                                                                                      | —                                                            | —                                       | Confirm 20/20-day commit rule met, full demo       |

## 5. Definition of Done

- **Mid Review:** local Kafka cluster running, producer streaming mock data,
  Faust/Bytewax topology consuming + windowing correctly, throughput audit
  passed (100k events/sec).
- **Final Review:** RocksDB-backed recovery survives a killed worker with no
  lost/duplicated readings, Prometheus metrics flowing into the React Flow
  dashboard, end-to-end demo works from producer to UI.

## 6. Uniqueness / Portfolio Differentiators

The base spec (Kafka + Faust + RocksDB + a dashboard) is already solid, but
these push it past a generic "streaming CRUD" demo:

- **Exactly-once, provably.** Idempotent + transactional Kafka
  producer/consumer, with a test that intentionally double-sends a batch and
  shows the sink never double-counts.
- **Schema Registry + Avro contracts.** Real data governance instead of raw JSON
  — includes a schema evolution demo (add a field, prove old consumers don't
  break).
- **Live chaos-engineering console.** A button in the dashboard that
  kills/revives a worker process on demand, with the partition rebalance and
  state recovery visible in real time on the DAG view — turns the SOP's required
  "chaos testing" into an actual product feature, not just a one-off script.
- **Digital fleet twin.** Instead of a plain line chart, a live map (Leaflet)
  plotting simulated truck positions with a heat overlay for temperature
  anomalies (z-score based alerting) — makes the demo visual and immediately
  legible to non-technical reviewers.
- **Time-travel replay.** Replay any Kafka topic from a given offset/timestamp
  to reconstruct exactly what state looked like at that moment — useful for
  debugging and a nice "wow" feature in a demo.
- **Multi-tenant isolation.** Two simulated fleet operators sharing the same
  cluster via topic-per-tenant with ACL isolation, proving the design holds up
  beyond a single-customer toy example.

Not all of these need to ship in Month 1 — treat them as a backlog to pull from
once the core pipeline (Weeks 1–4 above) is solid, roughly in the order listed.

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
│   ├── state_store/rocksdb_store.py     (State & Recovery)
│   ├── api/main.py                      (Backend/API)
│   └── metrics/                         (Backend/API)
├── frontend/README.md                   (Frontend)
├── tests/
└── docs/architecture.md
```
