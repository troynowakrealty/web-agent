#!/bin/bash

COMMAND="${1:-echo test}"
REPO_DIR="$(pwd)"

echo "📦 Verifying: $REPO_DIR"
echo "🧪 Command: $COMMAND"

curl -s -X POST http://localhost:5001/run-task \
  -H "Content-Type: application/json" \
  -d "{
    \"task\": \"shell\",
    \"params\": {
      \"command\": \"cd $REPO_DIR && python3 tasks/shell.py $COMMAND\"
    }
  }" | jq .
