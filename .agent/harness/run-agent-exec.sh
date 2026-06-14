#!/usr/bin/env bash
# 跑 agent 写代码任务：默认静默（完整输出写文件，stdout 只打摘要）；AGENT_VERBOSE=1 时透传全部输出。
#
# 环境变量：
#   AGENT_BACKEND=cursor|codex   默认 cursor
#   CURSOR_API_KEY               cursor 认证（runner 本机）
#   CURSOR_AGENT_MODEL           默认 composer-2.5
#   ~/.codex/auth.json           codex 认证
#
# 用法：run-agent-exec.sh /path/to/prompt.md
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-backend.sh
source "$HARNESS_DIR/agent-backend.sh"

PROMPT_FILE="${1:?prompt file path}"
test -f "$PROMPT_FILE" || { echo "::error::prompt file not found: $PROMPT_FILE"; exit 2; }

run_agent_exec "$PROMPT_FILE"
