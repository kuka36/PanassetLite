#!/usr/bin/env bash
# 跑 agent PR review（只读）；输出写入 review 文件。
#
# 用法：run-agent-review.sh /path/to/review-prompt.md [/path/to/review.md]
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-backend.sh
source "$HARNESS_DIR/agent-backend.sh"

PROMPT_FILE="${1:?review prompt file path}"
OUTPUT_FILE="${2:-/tmp/review.md}"
test -f "$PROMPT_FILE" || { echo "::error::prompt file not found: $PROMPT_FILE"; exit 2; }

run_agent_review "$PROMPT_FILE" "$OUTPUT_FILE" "$(pwd)"
