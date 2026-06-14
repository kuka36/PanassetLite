#!/usr/bin/env bash
# 跑 codex exec：默认静默（完整输出写文件，stdout 只打摘要）；CODEX_VERBOSE=1 时透传全部输出。
#
# 用法：run-codex-exec.sh /path/to/prompt.md
set -euo pipefail

PROMPT_FILE="${1:?prompt file path}"
CODEX_LOG="${CODEX_LOG:-/tmp/codex.log}"
SUMMARY_FILE="${CODEX_SUMMARY:-/tmp/agent-summary.md}"

test -f "$HOME/.codex/auth.json" || {
  echo "::error::~/.codex/auth.json missing — run 'codex login' on the self-hosted runner host."
  exit 3
}

codex_args=(
  exec
  --sandbox workspace-write
  --color never
  --output-last-message "$SUMMARY_FILE"
)

if [ "${CODEX_VERBOSE:-0}" = "1" ]; then
  echo "→ Codex 运行中（verbose，输出透传）…"
  codex "${codex_args[@]}" < "$PROMPT_FILE" 2>&1 | tee "$CODEX_LOG"
else
  echo "→ Codex 运行中…"
  echo "  完整日志: ${CODEX_LOG}"
  echo "  完成后可在 Actions Artifacts 下载 codex-log"
  codex "${codex_args[@]}" < "$PROMPT_FILE" >"$CODEX_LOG" 2>&1
  lines=$(wc -l <"$CODEX_LOG" | tr -d ' ')
  echo "→ Codex 完成（${lines} 行已写入日志）"
  echo ""
  if [ -s "$SUMMARY_FILE" ]; then
    echo "=== Agent 总结 ==="
    cat "$SUMMARY_FILE"
  else
    echo "=== 日志末尾（无 agent 总结文件）==="
    tail -n 30 "$CODEX_LOG"
  fi
fi
