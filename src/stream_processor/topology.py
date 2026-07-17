"""
Weeks 1-3 — Stream Processing (Owner: Stream Processing Engineer,
branch: dev/stream-processing)

Faust/Bytewax topology: Consume -> Filter(temp > 0) -> Map -> windowed
5-minute rolling average per truck.

TODO:
- [ ] Week 1: define the Faust/Bytewax app + topic schema
- [ ] Week 2: build Consume -> Filter -> Map pipeline; tumbling/hopping windows
- [ ] Mid Review: prove 100k events/sec across partitions
- [ ] Week 3: wire windowed output into the RocksDB changelog
      (see src/state_store/rocksdb_store.py)
"""

raise NotImplementedError("Define the Faust/Bytewax app here")
