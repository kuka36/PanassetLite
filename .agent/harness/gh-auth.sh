#!/usr/bin/env bash
# 配置 gh CLI 使用的 GH_TOKEN（须 source，勿直接执行）。
#
# GITHUB_TOKEN 默认不能 createPullRequest，除非仓库开启：
# Settings → Actions → General → Allow GitHub Actions to create and approve pull requests
#
# self-hosted runner 推荐在宿主机配置 GH_TOKEN（gh auth login 或 runner 服务环境变量）。
set -euo pipefail

if [ -n "${GH_TOKEN:-}" ]; then
  echo "→ gh: 使用 runner 宿主机 GH_TOKEN" >&2
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  export GH_TOKEN="$GITHUB_TOKEN"
  echo "→ gh: 使用 GITHUB_TOKEN（需仓库允许 Actions 创建 PR）" >&2
else
  echo "::error::未配置 GH_TOKEN：请在 runner 宿主机设置 GH_TOKEN / gh auth login，或确保 workflow 传入 GITHUB_TOKEN" >&2
  return 1 2>/dev/null || exit 1
fi
