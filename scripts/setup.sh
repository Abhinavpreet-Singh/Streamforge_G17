#!/usr/bin/env bash
set -e

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "Bringing up Kafka, Schema Registry, Kafka UI, Prometheus, Grafana..."
docker-compose up -d

echo "Done. Activate the venv with: source .venv/bin/activate"
echo "Kafka UI:    http://localhost:8080"
echo "Prometheus:  http://localhost:9090"
echo "Grafana:     http://localhost:3001"
