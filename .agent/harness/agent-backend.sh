#!/usr/bin/env bash
# Agent 后端抽象：通过 AGENT_BACKEND 在 cursor | codex 之间切换。
# 默认 cursor；凭证留在 runner 本机环境变量，不进 GitHub Secrets。
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# AGENT_BACKEND: cursor（默认）| codex
export AGENT_BACKEND="${AGENT_BACKEND:-cursor}"
AGENT_BACKEND="$(printf '%s' "$AGENT_BACKEND" | tr '[:upper:]' '[:lower:]')"

export AGENT_LOG="${AGENT_LOG:-/tmp/agent.log}"
export AGENT_SUMMARY="${AGENT_SUMMARY:-/tmp/agent-summary.md}"

agent_verbose() {
  [ "${AGENT_VERBOSE:-0}" = "1" ]
}

agent_backend_label() {
  case "$AGENT_BACKEND" in
    cursor) echo "Cursor" ;;
    codex)  echo "Codex" ;;
    *)      echo "$AGENT_BACKEND" ;;
  esac
}

find_cursor_agent_bin() {
  if command -v agent >/dev/null 2>&1; then
    command -v agent
    return 0
  fi
  local candidate
  for candidate in "$HOME/.cursor/bin/agent" "$HOME/.local/bin/agent"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ensure_agent_auth() {
  case "$AGENT_BACKEND" in
    cursor)
      if [ -z "${CURSOR_API_KEY:-}" ]; then
        echo "::error::CURSOR_API_KEY missing — set it in the self-hosted runner host environment."
        return 3
      fi
      if ! find_cursor_agent_bin >/dev/null; then
        echo "::error::Cursor CLI (agent) not found — run .agent/harness/install-tools.sh or curl https://cursor.com/install"
        return 3
      fi
      ;;
    codex)
      if [ ! -f "$HOME/.codex/auth.json" ]; then
        echo "::error::~/.codex/auth.json missing — run 'codex login' on the self-hosted runner host."
        return 3
      fi
      if ! command -v codex >/dev/null 2>&1; then
        echo "::error::codex CLI not found — npm i -g @openai/codex"
        return 3
      fi
      ;;
    *)
      echo "::error::Unknown AGENT_BACKEND='$AGENT_BACKEND' (expected cursor or codex)."
      return 3
      ;;
  esac
}

run_codex_agent() {
  local prompt_file="$1"
  local mode="${2:-write}" # write | review
  local output_file="${3:-$AGENT_SUMMARY}"

  local codex_args=(
    exec
    --color never
    --output-last-message "$output_file"
  )

  if [ "$mode" = "review" ]; then
    codex_args+=(--sandbox read-only)
  else
    codex_args+=(--sandbox workspace-write)
  fi

  if agent_verbose; then
    codex "${codex_args[@]}" < "$prompt_file" 2>&1 | tee "$AGENT_LOG"
  else
    codex "${codex_args[@]}" < "$prompt_file" >"$AGENT_LOG" 2>&1
    local lines
    lines=$(wc -l <"$AGENT_LOG" | tr -d ' ')
    echo "→ Codex 完成（${lines} 行已写入日志）"
    echo ""
    if [ -s "$output_file" ]; then
      echo "=== Agent 总结 ==="
      cat "$output_file"
    else
      echo "=== 日志末尾（无 agent 总结文件）==="
      tail -n 30 "$AGENT_LOG"
    fi
  fi
}

cursor_prompt_from_file() {
  local prompt_file="$1"
  # 避免超长 argv；让 agent 自行读取文件。
  printf 'Read the entire contents of %s and follow every instruction in it exactly. Do not ask clarifying questions; complete the task.' "$prompt_file"
}

install_cursor_review_cli_config() {
  local ws="${1:?workspace root}"
  local repo_cursor="$ws/.cursor"
  mkdir -p "$repo_cursor"
  if [ -f "$repo_cursor/cli.json" ]; then
    cp "$repo_cursor/cli.json" "$repo_cursor/cli.json.agent-harness-bak"
  fi
  cp "$HARNESS_DIR/cursor-review-cli.json" "$repo_cursor/cli.json"
}

restore_cursor_review_cli_config() {
  local ws="${1:?workspace root}"
  local repo_cursor="$ws/.cursor"
  if [ -f "$repo_cursor/cli.json.agent-harness-bak" ]; then
    mv "$repo_cursor/cli.json.agent-harness-bak" "$repo_cursor/cli.json"
  elif [ -f "$repo_cursor/cli.json" ]; then
    rm -f "$repo_cursor/cli.json"
  fi
}

run_cursor_agent() {
  local prompt_file="$1"
  local mode="${2:-write}" # write | review
  local output_file="${3:-$AGENT_SUMMARY}"
  local ws="${4:-$(pwd)}"

  local agent_bin
  agent_bin="$(find_cursor_agent_bin)"
  local prompt
  prompt="$(cursor_prompt_from_file "$prompt_file")"

  local agent_args=(
    -p "$prompt"
    --force
    --output-format text
    --model "${CURSOR_AGENT_MODEL:-composer-2.5}"
  )

  local review_config_installed=0
  if [ "$mode" = "review" ]; then
    install_cursor_review_cli_config "$ws"
    review_config_installed=1
  fi

  cleanup_review_config() {
    if [ "$review_config_installed" = 1 ]; then
      restore_cursor_review_cli_config "$ws"
    fi
  }
  trap cleanup_review_config EXIT

  if agent_verbose; then
    echo "→ Cursor Agent 运行中（verbose，输出透传）…"
    "$agent_bin" "${agent_args[@]}" 2>&1 | tee "$AGENT_LOG"
    cp "$AGENT_LOG" "$output_file"
  else
    echo "→ Cursor Agent 运行中…"
    echo "  完整日志: ${AGENT_LOG}"
    "$agent_bin" "${agent_args[@]}" >"$AGENT_LOG" 2>&1
    local lines
    lines=$(wc -l <"$AGENT_LOG" | tr -d ' ')
    echo "→ Cursor Agent 完成（${lines} 行已写入日志）"
    echo ""
    if [ -s "$AGENT_LOG" ]; then
      echo "=== Agent 总结 ==="
      cat "$AGENT_LOG"
    fi
  fi

  cp "$AGENT_LOG" "$output_file"
  trap - EXIT
  cleanup_review_config
}

run_agent_exec() {
  local prompt_file="${1:?prompt file path}"
  ensure_agent_auth

  if [ "${AGENT_APPEND_LOG:-0}" != 1 ]; then
    : >"$AGENT_LOG"
    : >"$AGENT_SUMMARY"
  else
    {
      echo ""
      echo "=== Agent fix round ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ==="
    } >>"$AGENT_LOG"
  fi

  case "$AGENT_BACKEND" in
    cursor)
      echo "→ 使用 Cursor CLI（AGENT_BACKEND=cursor）"
      run_cursor_agent "$prompt_file" write "$AGENT_SUMMARY" "$(pwd)"
      ;;
    codex)
      echo "→ 使用 Codex CLI（AGENT_BACKEND=codex）"
      if agent_verbose; then
        echo "→ Codex 运行中（verbose，输出透传）…"
      else
        echo "→ Codex 运行中…"
        echo "  完整日志: ${AGENT_LOG}"
        echo "  完成后可在 Actions Artifacts 下载 agent-log"
      fi
      run_codex_agent "$prompt_file" write "$AGENT_SUMMARY"
      ;;
  esac
}

run_agent_review() {
  local prompt_file="${1:?prompt file path}"
  local output_file="${2:-/tmp/review.md}"
  local ws="${3:-$(pwd)}"

  ensure_agent_auth
  : >"$AGENT_LOG"

  case "$AGENT_BACKEND" in
    cursor)
      echo "→ 使用 Cursor CLI 进行 review（只读权限）"
      run_cursor_agent "$prompt_file" review "$output_file" "$ws"
      ;;
    codex)
      echo "→ 使用 Codex CLI 进行 review（read-only sandbox）"
      run_codex_agent "$prompt_file" review "$output_file"
      ;;
  esac

  if [ ! -s "$output_file" ]; then
    echo "::error::$(agent_backend_label) produced no review output (interrupted or failed)."
    return 4
  fi
}

preflight_agent_backend() {
  local ok=1
  command -v node >/dev/null || { echo "✗ 缺 node"; ok=0; }
  command -v npm >/dev/null  || { echo "✗ 缺 npm"; ok=0; }
  command -v git >/dev/null  || { echo "✗ 缺 git"; ok=0; }
  node -v | grep -qE '^v2[0-9]' || echo "⚠ 建议 Node.js 20+（与 CI 一致）"

  echo "→ AGENT_BACKEND=${AGENT_BACKEND}（可用 AGENT_BACKEND=codex|cursor 切换）"

  case "$AGENT_BACKEND" in
    cursor)
      if find_cursor_agent_bin >/dev/null; then
        echo "✓ Cursor CLI: $(find_cursor_agent_bin)"
      else
        echo "✗ 缺 Cursor CLI → curl https://cursor.com/install 或 .agent/harness/install-tools.sh"
        ok=0
      fi
      if [ -n "${CURSOR_API_KEY:-}" ]; then
        echo "✓ CURSOR_API_KEY 已设置"
      else
        echo "✗ 缺 CURSOR_API_KEY → 在 runner 环境变量中配置"
        ok=0
      fi
      ;;
    codex)
      if command -v codex >/dev/null; then
        echo "✓ codex: $(command -v codex)"
      else
        echo "✗ 缺 codex → npm i -g @openai/codex"
        ok=0
      fi
      if [ -f "$HOME/.codex/auth.json" ]; then
        echo "✓ ~/.codex/auth.json 存在"
      else
        echo "✗ 缺 ~/.codex/auth.json → 先 codex login"
        ok=0
      fi
      ;;
    *)
      echo "✗ 未知 AGENT_BACKEND='$AGENT_BACKEND'（应为 cursor 或 codex）"
      ok=0
      ;;
  esac

  [ "$ok" = 1 ] && echo "✓ preflight 通过"
  [ "$ok" = 1 ]
}

agent_co_author_trailer() {
  case "$AGENT_BACKEND" in
    cursor) echo "Co-Authored-By: Cursor Agent <agent@panassetlite.local>" ;;
    codex)  echo "Co-Authored-By: Codex Agent <agent@panassetlite.local>" ;;
    *)      echo "Co-Authored-By: AI Agent <agent@panassetlite.local>" ;;
  esac
}
