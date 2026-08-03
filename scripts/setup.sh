#!/usr/bin/env bash
set -e

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "Bringing up Kafka, Schema Registry, Kafka UI, Prometheus, Grafana..."
docker-compose up -d

echo "Waiting for Kafka to accept connections..."
until docker compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; do
  sleep 2
done

bash scripts/create_topics.sh
python scripts/register_schema.py

echo "Done. Activate the venv with: source .venv/bin/activate"
echo "Validate dataset: python scripts/validate_dataset.py"
echo "Kafka UI:    http://localhost:8080"
echo "Prometheus:  http://localhost:9090"
echo "Grafana:     http://localhost:3001"
