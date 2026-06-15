#!/usr/bin/env bash
# 开或更新 PR（agent-run.yml 使用）。
# 用法：open-or-update-pr.sh <issue_number> <issue_title> <branch>
set -euo pipefail

issue_num="${1:?issue number}"
issue_title="${2:?issue title}"
branch="${3:?branch}"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"

# shellcheck source=gh-auth.sh
source "$HARNESS_DIR/gh-auth.sh"
bash "$HARNESS_DIR/generate-pr-body.sh" "$issue_num" "$issue_title" > /tmp/pr-body.md

pr_num=$(gh pr list --head "$branch" --state open --json number -q '.[0].number' || true)
if [ -n "$pr_num" ]; then
  echo "Updating PR #$pr_num for $branch"
  gh pr edit "$pr_num" --body-file /tmp/pr-body.md
  exit 0
fi

label_args=()
if gh label list --json name -q '.[].name' 2>/dev/null | grep -qx 'ai-generated'; then
  label_args=(--label ai-generated)
else
  echo "::warning::仓库无 ai-generated 标签，将创建不带该标签的 PR"
fi

gh pr create \
  --base main \
  --head "$branch" \
  --title "$issue_title" \
  --body-file /tmp/pr-body.md \
  "${label_args[@]}"
