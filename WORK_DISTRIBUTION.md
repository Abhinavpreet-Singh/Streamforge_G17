# Work Distribution Document — StreamForge (Month 1, Project 1)

Per Axlero Solutions SOP §9.10, this must be submitted before the Month 1 Mid Review (23rd–30th).

| Member | Branch | Role | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|---|---|
| You (Lead) | `dev/lead` | Kafka Foundation & Integration | Stand up Kafka/Zookeeper, mock producer | Register Avro schema | Integration pass across branches | Merge freeze, demo prep |
| Member 2 | `dev/stream-processing` | Stream Processing | Faust/Bytewax app skeleton | Consume→Filter→Map, windowing | Wire output to changelog | — |
| Member 3 | `dev/state-store` | State & Fault Tolerance | — | — | RocksDB store + changelog backup, chaos test | — |
| Member 4 | `dev/backend-api` | Backend API & Observability | FastAPI scaffold, `/health` | — | — | `/metrics`, `/topology`, `/ws/live` |
| Member 5 | `dev/frontend` | Frontend/Dashboard | React Flow canvas scaffold | — | Telemetry dashboard components | Wire metrics in, polish |

**Revision rule:** if a member goes unresponsive for 48+ hours, update this table to reflect the
reassigned tasks per SOP §6, and note the reassignment date below.

## Reassignment Log

_(none yet)_
