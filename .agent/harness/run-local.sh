#!/usr/bin/env bash
# 本地手动跑 agent 任务（不经过 GitHub），行为与 agent-run.yml 对齐。
#
# 用法：
#   .agent/harness/run-local.sh preflight              # 检查依赖（按 AGENT_BACKEND）
#   .agent/harness/run-local.sh probe "提示词"           # 最小 agent 验证
#   .agent/harness/run-local.sh task "标题" "需求正文"    # 完整复现：agent + lint + build + 路径校验
#
# 环境变量：
#   AGENT_BACKEND=cursor|codex   默认 cursor
#
# 调试顺序建议：preflight -> probe "say hi" -> task "..." "..."
set -euo pipefail

WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$WS"

# shellcheck source=agent-backend.sh
source "$HARNESS/agent-backend.sh"

build_prompt() {
  local issue_num="${1:-local}"
  local title="${2:?}"
  local body="${3:-}"
  printf '# Issue #%s: %s\n\n%s\n' "$issue_num" "$title" "$body" > /tmp/task.md
  { cat "$WS/.github/agent-instructions.md"; echo; cat /tmp/task.md; } > /tmp/prompt.md
}

probe_once() {
  local prompt="${1:?用法: run-local.sh probe \"提示词\"}"
  preflight_agent_backend
  local tmp
  tmp="$(mktemp /tmp/agent-probe.XXXXXX.md)"
  printf '%s' "$prompt" >"$tmp"
  run_agent_exec "$tmp"
  rm -f "$tmp"
}

task() {
  local title="${1:?用法: run-local.sh task \"标题\" \"需求正文\"}"
  local body="${2:-}"
  bash "$HARNESS/preflight-harness.sh"
  preflight_agent_backend
  build_prompt "local" "$title" "$body"

  echo "→ $(agent_backend_label) 执行任务（与线上一致的 agent-instructions + issue）…"
  echo "  设 AGENT_VERBOSE=1 可查看完整输出"
  bash "$HARNESS/run-agent-exec.sh" /tmp/prompt.md

  echo "→ 校验 lint/build（失败时自动修复，与线上一致）…"
  AGENT_FIX_MAX_ROUNDS="${AGENT_FIX_MAX_ROUNDS:-2}" bash "$HARNESS/verify-and-fix.sh"

  if [ -z "$(git status --porcelain)" ]; then
    echo "::error::Agent 未产生任何改动"
    exit 2
  fi

  bash "$HARNESS/gate-paths.sh"

  echo ""
  echo "→ 改动如下（未提交，留给你检查）："
  git status --short
  echo ""
  echo "✓ lint + build 通过，路径校验通过"
}

case "${1:-}" in
  preflight) preflight_agent_backend ;;
  probe)     shift; probe_once "${1:-}" ;;
  task)      shift; task "${1:-}" "${2:-}" ;;
  *)
    sed -n '2,13p' "$0"
    exit 1
    ;;
esac
