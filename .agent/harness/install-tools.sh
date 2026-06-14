#!/usr/bin/env bash
# 易变 / 应用层开发工具的统一安装入口。
# 以后增删工具只改这里，不要动 Dockerfile 的系统层逻辑。
set -euo pipefail

# npm 全局工具。版本集中在变量里管理：
# - 默认钉死具体版本，保证 agent 流程可复现（latest 哪天 break 了很难追溯）
# - 需要临时跟最新时，可在构建/运行时用环境变量覆盖：CODEX_VERSION=latest
CODEX_VERSION="${CODEX_VERSION:-0.135.0}"

npm install -g "@openai/codex@${CODEX_VERSION}"

# 将来加别的工具就往下加，例如：
# npm install -g some-cli@1.2.3
