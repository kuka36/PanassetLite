#!/usr/bin/env bash
# Agent 实现后校验 lint/build；失败则追加修复轮次（默认最多 2 轮）。
#
# 环境变量：AGENT_FIX_MAX_ROUNDS（默认 2）
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-backend.sh
source "$HARNESS_DIR/agent-backend.sh"

MAX_ROUNDS="${AGENT_FIX_MAX_ROUNDS:-2}"

if bash "$HARNESS_DIR/verify-quality.sh"; then
  echo "✓ lint + build 通过"
  exit 0
fi

attempt=1
while [ "$attempt" -le "$MAX_ROUNDS" ]; do
  echo "→ lint/build 未通过，启动修复轮次 ${attempt}/${MAX_ROUNDS}…"
  bash "$HARNESS_DIR/build-fix-prompt.sh" > /tmp/fix-prompt.md
  export AGENT_APPEND_LOG=1
  run_agent_exec /tmp/fix-prompt.md

  if bash "$HARNESS_DIR/verify-quality.sh"; then
    echo "✓ 修复轮次 ${attempt} 后 lint + build 通过"
    exit 0
  fi

  attempt=$((attempt + 1))
done

echo "::error::lint/build 在 ${MAX_ROUNDS} 轮修复后仍未通过"
exit 1
