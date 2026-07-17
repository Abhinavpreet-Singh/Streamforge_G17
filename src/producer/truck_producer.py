"""
Week 1 — Kafka Foundation (Owner: Team Lead, branch: dev/lead)

Blast mock IoT truck telemetry (truck_id, temp, timestamp) into the
`truck-telemetry` Kafka topic using a high-throughput confluent-kafka
producer.

TODO:
- [ ] Spin up local Kafka cluster (see docker-compose.yml)
- [ ] Implement an idempotent + transactional producer
      (uniqueness feature: exactly-once proof, see README §6)
- [ ] Register an Avro schema for TruckReading in Schema Registry
- [ ] Simulate 50,000 trucks each sending a reading every 10s
"""

TOPIC = "truck-telemetry"


def main() -> None:
    raise NotImplementedError("Week 1: implement the producer here")


if __name__ == "__main__":
    main()
