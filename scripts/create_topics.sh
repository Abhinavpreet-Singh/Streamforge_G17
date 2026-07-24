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

OUTPUT_TOPIC=truck-averages
echo "Creating topic '$OUTPUT_TOPIC' ($PARTITIONS partitions)..."
docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "$OUTPUT_TOPIC" \
  --partitions "$PARTITIONS" \
  --replication-factor "$REPLICATION"

docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 --describe --topic "$OUTPUT_TOPIC"

# Log-compacted: recovery only needs the latest state per truck, so
# compaction keeps replay bounded as the changelog grows.
CHANGELOG_TOPIC=truck-state-changelog
echo "Creating topic '$CHANGELOG_TOPIC' ($PARTITIONS partitions, compacted)..."
docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "$CHANGELOG_TOPIC" \
  --partitions "$PARTITIONS" \
  --replication-factor "$REPLICATION" \
  --config cleanup.policy=compact

docker compose exec -T kafka kafka-topics \
  --bootstrap-server localhost:9092 --describe --topic "$CHANGELOG_TOPIC"
