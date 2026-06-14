#!/usr/bin/env bash
# 根据当前分支相对 main 的 diff 生成 PR 描述（agent-run.yml 使用）。
set -euo pipefail

issue_num="${1:?issue number}"
issue_title="${2:?issue title}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

base=""
for candidate in origin/main main; do
  if git rev-parse --verify "$candidate" >/dev/null 2>&1; then
    base="$candidate"
    break
  fi
done

files="（无 diff）"
stat="（无 diff）"
if [ -n "$base" ]; then
  files=$(git diff --name-only "${base}...HEAD" | sed '/^$/d' || true)
  stat=$(git diff --stat "${base}...HEAD" | tail -n 20 || true)
  [ -z "$files" ] && files="（无 diff）"
  [ -z "$stat" ] && stat="（无 diff）"
fi

cat <<EOF
## Summary

自动实现 Issue #${issue_num}：**${issue_title}**

### 变更文件

\`\`\`
${files}
\`\`\`

### Diff 统计

\`\`\`
${stat}
\`\`\`

## Test plan

- [x] \`npm run lint\` 通过（Agent run 已执行）
- [x] \`npm run build\` 通过（Agent run 已执行）
- [ ] 手动验证（如适用）：财务计算、自然语言记账、确认弹窗等核心路径

## Notes

由 Agent 自动生成。请人工确认业务逻辑与 UI 交互。

---
Closes #${issue_num}
EOF
