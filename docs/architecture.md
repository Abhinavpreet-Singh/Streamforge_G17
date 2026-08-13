# StreamForge — Architecture Overview

```
50,000 simulated trucks (live: 100–500 in demo mode)
        │  truck_id, temperature, timestamp, fuel, lat/lng (Avro)
        ▼
 truck_producer.py  ──►  Kafka: truck-telemetry (20 partitions)
                                 │
                                 ▼
              Faust topology (consumer group: streamforge)
              Dedup → Filter(temp > 0) → Map → Tumbling + Hopping
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     Faust state tables   truck-averages     RocksDB dual-write
     (local *-dat)              │            + truck-state-changelog
                                ▼
                         FastAPI /ws/live
                                │
                                ▼
                   React dashboard (map, DAG, throughput, metrics)
```

## Components

| Piece | Role |
| --- | --- |
| Producer | Idempotent Kafka producer, Avro validation, GPS + fuel |
| Faust worker | Stream DAG, windowed averages per truck (single `stream-processor`) |
| RocksDB store | Live dual-write of rolling averages + `chaos_recovery_demo` |
| FastAPI | `/health`, `/metrics`, `/topology`, `/api/status`, `/ws/live`, worker start/kill/logs |
| Dashboard | Leaflet map (Kafka GPS), React Flow DAG, Recharts, Grafana embeds |

## Recovery

**Chaos from UI:** Crash worker → wipe Faust `*-dat` + RocksDB dir → Start again → Kafka replay rebuilds windows; changelog remains available for the RocksDB demo path.

Standalone proof: `scripts/chaos_recovery_demo.py`.
