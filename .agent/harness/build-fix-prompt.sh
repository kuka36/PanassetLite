#!/usr/bin/env bash
# 根据 /tmp/lint.log、/tmp/build.log 生成修复提示词（stdout）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cat "$ROOT/.github/agent-instructions.md"
cat <<'EOF'

---

# 修复 lint / build 失败

实现阶段已完成，但 `npm run lint` 或 `npm run build` 未通过。请修复下方**全部**错误直至两项命令均通过。

## 要求

- **保留已实现的任务功能**，只修质量门禁失败项。
- 若错误位于本次未改动的文件，仍须修复（否则 PR 无法通过 CI）。
- 修复后必须执行 `npm run lint` 与 `npm run build` 确认通过。
- 不要询问，直接修复。

## Lint 输出

```
EOF
cat /tmp/lint.log 2>/dev/null || echo '(无 lint 日志)'
cat <<'EOF'
```

## Build 输出

```
EOF
cat /tmp/build.log 2>/dev/null || echo '(无 build 日志)'
echo '```'
