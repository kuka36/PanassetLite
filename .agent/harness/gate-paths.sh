#!/usr/bin/env bash
# 拒绝 Agent 改动敏感路径（与 agent-run.yml 共用）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# 前缀或精确匹配（相对仓库根目录）
DENIED=(
  '.github/workflows/'
  '.cursor/'
  '.github/agent-instructions.md'
  '.github/agent-review-instructions.md'
  '.env'
)

collect_changed() {
  {
    git diff --name-only HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sed '/^$/d' | sort -u
}

is_denied() {
  local file="$1"
  local pattern
  for pattern in "${DENIED[@]}"; do
    if [[ "$file" == "$pattern" ]] || [[ "$file" == "$pattern"* ]]; then
      return 0
    fi
    if [[ "$pattern" == '.env' && "$file" == .env.* ]]; then
      return 0
    fi
  done
  return 1
}

violations=()
count=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  count=$((count + 1))
  if is_denied "$file"; then
    violations+=("$file")
  fi
done < <(collect_changed)

if [ "$count" -eq 0 ]; then
  echo "::error::没有检测到文件变更"
  exit 1
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Agent 修改了禁止变更的路径："
  printf '  - %s\n' "${violations[@]}"
  echo "禁止范围：workflows、.cursor/、agent 指令文件、.env"
  exit 1
fi

echo "✓ 路径校验通过（${count} 个文件）"
