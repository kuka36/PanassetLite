#!/usr/bin/env bash
# checkout 后校验 harness 与 agent 指令文件齐全，避免跑到一半才因缺脚本失败。
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"

REQUIRED=(
  "$HARNESS_DIR/gh-auth.sh"
  "$HARNESS_DIR/agent-backend.sh"
  "$HARNESS_DIR/run-agent-exec.sh"
  "$HARNESS_DIR/run-agent-review.sh"
  "$HARNESS_DIR/verify-and-fix.sh"
  "$HARNESS_DIR/verify-quality.sh"
  "$HARNESS_DIR/tee-exec.sh"
  "$HARNESS_DIR/build-fix-prompt.sh"
  "$HARNESS_DIR/gate-paths.sh"
  "$HARNESS_DIR/open-or-update-pr.sh"
  "$HARNESS_DIR/generate-pr-body.sh"
  "$HARNESS_DIR/cursor-review-cli.json"
  "$ROOT/.github/agent-instructions.md"
  "$ROOT/.github/agent-review-instructions.md"
)

missing=0
for f in "${REQUIRED[@]}"; do
  rel="${f#$ROOT/}"
  if [ ! -f "$f" ]; then
    echo "::error::缺少必需文件: $rel"
    missing=1
  elif [[ "$f" == *.sh ]] && [ ! -x "$f" ]; then
    echo "::warning::脚本不可执行: $rel"
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "✓ harness 文件校验通过（${#REQUIRED[@]} 项）"
