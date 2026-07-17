"""
Week 3 — State & Fault Tolerance (Owner: State Store Engineer,
branch: dev/state-store)

Embedded key-value store (rocksdict) holding rolling-average state per
truck, backed by a Kafka changelog topic for recovery.

TODO:
- [ ] Implement get/put/checkpoint against rocksdict
- [ ] Back running aggregations up to a `truck-state-changelog` topic
- [ ] Chaos Testing (Mid/Final Review requirement): kill a worker
      process mid-calculation, prove the partition rebalances and
      state recovers with zero data loss
- [ ] Stretch (uniqueness): wire a "kill/revive worker" control into
      the dashboard so chaos testing is a live, demoable feature
"""

raise NotImplementedError("Implement the RocksDB-backed state store here")
