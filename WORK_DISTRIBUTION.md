# Work Distribution Document — StreamForge (Month 1, Project 1)

Per Axlero Solutions SOP §9.10, this must be submitted before the Month 1 Mid Review (23rd–30th).

Team size is 6, not the 5 implied by the original role template. Roles below are assigned by
current skill fit rather than by the doc's default split — see **Distribution Rationale** at the
bottom. Every member still gets a real, demo-relevant deliverable and commits to their own branch.

| Member | Branch | Role | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|---|---|
| Abhinavpreet (Lead) | `Abhinavpreet` | Kafka Foundation & Integration | Docker-compose stack up, Kafka topics created, producer implemented | Avro schema registered | Integration pass across branches | Merge freeze, demo prep |
| Member 2 | `Meven` | Stream Processing | Faust/Bytewax app skeleton, consumer prints raw messages | Consume→Filter→Map, windowing | Wire output to changelog topic; partition-rebalance behavior | Performance tuning, throughput audit |
| Member 3 | _TBD_ | Data Simulation & Validation | 50k-truck synthetic dataset (pandas/numpy/faker) | Validation scripts (expected vs. system average) | Recovery verification (pre/post-crash average comparison) | Benchmark report + charts |
| Member 4 | _TBD_ | Frontend Dashboard | React + React Flow scaffold, static DAG boxes | — | Live telemetry dashboard components | Wire in metrics, polish UI |
| Member 5 | _TBD_ | Documentation, Testing & Chaos | Architecture/workflow/team diagrams | Test cases (valid/invalid temp, missing truck ID, late data) | Chaos-testing scripts (kill/restart worker), results documented | Demo script, review deck |
| Member 6 | _TBD_ | Backend API | FastAPI scaffold, `/health` | `/metrics`, `/topology` | `/ws/live` WebSocket | Backend↔frontend integration |

Branch pool still to be assigned: `Meven`, `Noore`, `Raghavendra`, `Shifana`, `Surya`. Fill in the
`_TBD_` cells once roles are confirmed with the team.

## Distribution Rationale

The Axlero project doc's default split (Lead / Stream Processing / State & Fault-Tolerance /
Backend API / Frontend) assumes 5 similarly-skilled members. This team of 6 has mixed experience
(one strong secondary coder, one pandas/data person, two ECE members newer to backend work, one
unknown skill level), so work is split by current skill fit instead:

- Stream Processing and Backend API (the two hardest coding roles) go to the strongest members
  after the Lead.
- Data Simulation & Validation is a self-contained, low-risk role — good fit for someone comfortable
  with pandas/CSV work but not Kafka internals.
- Frontend Dashboard and Documentation/Testing/Chaos are lower-barrier-to-entry roles for members
  newer to this stack, while still being demo-critical (a working dashboard and solid chaos-test
  evidence are exactly what reviewers check).
- State & Fault-Tolerance (RocksDB) work is folded into Stream Processing's Week 3 deliverable
  rather than kept as a standalone role, since it directly depends on the stream processor's output.

This is a workload-equalizing reassignment, not a response to any member being unresponsive — it's
recorded here for transparency, separate from the Reassignment Log below.

**Revision rule:** if a member goes unresponsive for 48+ hours, update the table above to reflect
the reassigned tasks per SOP §6, and log it below.

## Reassignment Log

_(none yet)_
