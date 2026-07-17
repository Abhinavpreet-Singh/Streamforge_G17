# StreamForge — Architecture Overview

```
50,000 simulated trucks
        │  (temp, truck_id, timestamp every 10s)
        ▼
 truck_producer.py  ──►  Kafka topic: truck-telemetry (Avro, Schema Registry)
                                 │
                                 ▼
                  Faust/Bytewax topology (20 parallel workers)
                  Consume → Filter(temp > 0) → Map → 5-min window
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
          RocksDB state store       Kafka changelog topic
          (rolling avg per truck)   (recovery source of truth)
                     │
                     ▼
          FastAPI topology API (/health, /metrics, /topology, /ws/live)
                     │
                     ▼
          React Flow dashboard (DAG view + digital fleet twin map)
```

If a worker dies mid-calculation, its partitions are reassigned to a healthy worker, which rebuilds
its in-memory state from the RocksDB changelog before resuming — no reading is dropped or double
counted.
