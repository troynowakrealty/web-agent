#!/bin/bash
COMMAND="${1:-echo test}"
AGENT_PATH="$(pwd)"
LOCAL_AGENT_URL="http://localhost:5001/run-task"
MAX_RETRIES=3

function test_shell() {
  curl -s -X POST "$LOCAL_AGENT_URL" \
    -H "Content-Type: application/json" \
    -d "{\"task\":\"shell\",\"params\":{\"command\":\"cd $AGENT_PATH && python3 tasks/shell.py $COMMAND\"}}"
}

function is_failure() {
  [[ "$1" == *"connection refused"* || "$1" == *"can't open file"* || "$1" == *"error"* || "$1" == *"status\":\"error"* ]]
}

for attempt in $(seq 1 $MAX_RETRIES); do
  echo "🔁 Attempt $attempt..."
  OUTPUT=$(test_shell)
  if is_failure "$OUTPUT"; then
    echo "⚠️  Test failed. Output:"
    echo "$OUTPUT"
    echo "🔧 Restarting local-agent..."
    pm2 restart local-agent >/dev/null
    sleep 2
  else
    echo "✅ Success:"
    echo "$OUTPUT" | jq .
    exit 0
  fi
done

echo "❌ Failed after $MAX_RETRIES attempts. Final output:"
echo "$OUTPUT"
exit 1
