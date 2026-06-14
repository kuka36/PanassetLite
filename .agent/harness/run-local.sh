#!/usr/bin/env bash
# 本地手动跑 agent 任务（不经过 GitHub），行为与 agent-run.yml 对齐。
#
# 用法：
#   .agent/harness/run-local.sh preflight              # 检查依赖
#   .agent/harness/run-local.sh codex "提示词"          # 最小 codex 验证
#   .agent/harness/run-local.sh task "标题" "需求正文"    # 完整复现：codex + lint + build + 路径校验
#
# 调试顺序建议：preflight -> codex "say hi" -> task "..." "..."
set -euo pipefail

WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$WS"

preflight() {
  local ok=1
  command -v node >/dev/null    || { echo "✗ 缺 node"; ok=0; }
  command -v npm >/dev/null     || { echo "✗ 缺 npm"; ok=0; }
  command -v codex >/dev/null   || { echo "✗ 缺 codex → npm i -g @openai/codex"; ok=0; }
  command -v git >/dev/null     || { echo "✗ 缺 git"; ok=0; }
  test -f "$HOME/.codex/auth.json" || { echo "✗ 缺 ~/.codex/auth.json → 先 codex login"; ok=0; }
  node -v | grep -qE '^v2[0-9]' || echo "⚠ 建议 Node.js 20+（与 CI 一致）"
  [ "$ok" = 1 ] && echo "✓ preflight 通过"
  [ "$ok" = 1 ]
}

build_prompt() {
  local issue_num="${1:-local}"
  local title="${2:?}"
  local body="${3:-}"
  printf '# Issue #%s: %s\n\n%s\n' "$issue_num" "$title" "$body" > /tmp/task.md
  { cat "$WS/.github/agent-instructions.md"; echo; cat /tmp/task.md; } > /tmp/prompt.md
}

codex_once() {
  local prompt="${1:?用法: run-local.sh codex \"提示词\"}"
  preflight
  printf '%s' "$prompt" | codex exec --sandbox workspace-write
}

task() {
  local title="${1:?用法: run-local.sh task \"标题\" \"需求正文\"}"
  local body="${2:-}"
  preflight
  build_prompt "local" "$title" "$body"

  echo "→ codex 执行任务（与线上一致的 agent-instructions + issue）…"
  codex exec --sandbox workspace-write < /tmp/prompt.md

  echo "→ npm run lint…"
  npm run lint 2>&1 | tee /tmp/lint.log

  echo "→ npm run build…"
  npm run build 2>&1 | tee /tmp/build.log

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
  preflight) preflight ;;
  codex)     shift; codex_once "${1:-}" ;;
  task)      shift; task "${1:-}" "${2:-}" ;;
  *)
    sed -n '2,9p' "$0"
    exit 1
    ;;
esac
