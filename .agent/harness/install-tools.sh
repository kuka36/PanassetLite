#!/usr/bin/env bash
# 易变 / 应用层开发工具的统一安装入口。
# 以后增删工具只改这里，不要动 Dockerfile 的系统层逻辑。
#
# 环境变量：
#   AGENT_BACKEND=cursor|codex     默认 cursor，只安装当前后端
#   INSTALL_ALL_AGENT_BACKENDS=1   同时安装 cursor + codex
set -euo pipefail

AGENT_BACKEND="${AGENT_BACKEND:-cursor}"
AGENT_BACKEND="$(printf '%s' "$AGENT_BACKEND" | tr '[:upper:]' '[:lower:]')"

install_cursor_cli() {
  if command -v agent >/dev/null 2>&1 || [ -x "$HOME/.cursor/bin/agent" ] || [ -x "$HOME/.local/bin/agent" ]; then
    echo "✓ Cursor CLI 已存在"
    return 0
  fi
  echo "→ 安装 Cursor CLI…"
  curl https://cursor.com/install -fsS | bash
  for bin_dir in "$HOME/.cursor/bin" "$HOME/.local/bin"; do
    if [ -d "$bin_dir" ]; then
      case ":$PATH:" in
        *":$bin_dir:"*) ;;
        *) export PATH="$bin_dir:$PATH" ;;
      esac
    fi
  done
  command -v agent >/dev/null || [ -x "$HOME/.cursor/bin/agent" ] || {
    echo "✗ Cursor CLI 安装后仍未找到 agent 命令，请把 ~/.cursor/bin 或 ~/.local/bin 加入 PATH"
    return 1
  }
}

install_codex_cli() {
  CODEX_VERSION="${CODEX_VERSION:-0.135.0}"
  echo "→ 安装 Codex CLI @${CODEX_VERSION}…"
  npm install -g "@openai/codex@${CODEX_VERSION}"
}

case "$AGENT_BACKEND" in
  cursor)
    install_cursor_cli
    ;;
  codex)
    install_codex_cli
    ;;
  *)
    echo "✗ 未知 AGENT_BACKEND='$AGENT_BACKEND'（应为 cursor 或 codex）"
    exit 1
    ;;
esac

if [ "${INSTALL_ALL_AGENT_BACKENDS:-0}" = "1" ]; then
  case "$AGENT_BACKEND" in
    cursor) install_codex_cli ;;
    codex)  install_cursor_cli ;;
  esac
fi

echo "✓ install-tools 完成（AGENT_BACKEND=${AGENT_BACKEND}）"
