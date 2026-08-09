# StreamForge — Architecture Overview

```
50,000 simulated trucks (live: 100–500 in demo mode)
        │  truck_id, temperature, timestamp (Avro-validated)
        ▼
 truck_producer.py  ──►  Kafka: truck-telemetry (20 partitions)
                                 │
                                 ▼
              Faust topology (consumer group: streamforge)
              Dedup → Filter(temp > 0) → Map → Tumbling + Hopping windows
                                 │
                     ┌───────────┴────────────┐
                     ▼                        ▼
           Faust state tables          truck-averages topic
           (local *-dat store)                 │
                     │                        ▼
           RocksDB + changelog          FastAPI /ws/live
           (chaos_recovery_demo)              │
                     │                        ▼
                     └──────────►  React dashboard (map, DAG, throughput chart)
```

## Components

| Piece | Role |
| --- | --- |
| Producer | Idempotent Kafka producer, Avro validation |
| Faust workers | Stream DAG, windowed averages per truck |
| RocksDB store | Used in `chaos_recovery_demo` + tests; Faust tables in live path |
| FastAPI | `/health`, `/metrics`, `/topology`, `/api/status`, `/ws/live`, worker control |
| Dashboard | Leaflet map, React Flow DAG, Recharts throughput, chaos panel |

## Recovery

Worker crash → partitions rebalance → new worker replays Faust state / changelog demo proves
RocksDB + Kafka changelog convergence with zero data loss (`scripts/chaos_recovery_demo.py`).
