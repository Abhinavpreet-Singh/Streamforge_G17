#!/usr/bin/env bash
set -e

# Kafka's auto-create (see docker-compose.yml) makes topics with 1 partition
# on first use, which caps throughput at 1 consumer regardless of worker
# count. Create the real topics explicitly instead.

TOPIC=truck-telemetry
PARTITIONS=20
REPLICATION=1

echo "Creating topic '$TOPIC' ($PARTITIONS partitions)..."
docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "$TOPIC" \
  --partitions "$PARTITIONS" \
  --replication-factor "$REPLICATION"

docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 --describe --topic "$TOPIC"
