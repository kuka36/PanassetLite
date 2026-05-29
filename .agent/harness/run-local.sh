#!/usr/bin/env bash
# 本地手动跑 agent 任务（不经过 GitHub），用于调试。
# 底层用的就是 GitHub Action `devcontainers/ci` 同款的 @devcontainers/cli，
# 所以这里能跑通 = CI 也能跑通。
#
# 用法：
#   .agent/harness/run-local.sh preflight        # 检查依赖
#   .agent/harness/run-local.sh up               # 清旧容器 + 构建并启动（含 npm ci）
#   .agent/harness/run-local.sh proxy             # 在容器内验证能否访问 chatgpt.com
#   .agent/harness/run-local.sh shell             # 进容器开交互 shell
#   .agent/harness/run-local.sh codex "提示词"     # 容器内只跑一次 codex（最小验证）
#   .agent/harness/run-local.sh task "标题" "需求"  # 完整复现：codex 改代码 + npm run build
#
# 调试顺序建议：preflight -> up -> proxy -> codex "say hi" -> task "..." "..."
set -euo pipefail

# 仓库根目录（脚本在 .agent/harness/ 下）
WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$WS"

# 把 .devcontainer/.env 导出到当前进程环境，使 devcontainer.json 里的
# ${localEnv:HTTP_PROXY} 在【构建期】也能拿到代理（build.args 透传给 BuildKit）。
load_env() {
  if [ -f "$WS/.devcontainer/.env" ]; then
    set -a; . "$WS/.devcontainer/.env"; set +a
  fi
}

dexec() { devcontainer exec --workspace-folder "$WS" "$@"; }

preflight() {
  local ok=1
  command -v docker >/dev/null      || { echo "✗ 缺 docker"; ok=0; }
  docker info >/dev/null 2>&1        || { echo "✗ docker 守护进程未运行"; ok=0; }
  command -v devcontainer >/dev/null || { echo "✗ 缺 devcontainer CLI → npm i -g @devcontainers/cli"; ok=0; }
  test -f "$HOME/.codex/auth.json"   || { echo "✗ 缺 ~/.codex/auth.json → 先 codex login"; ok=0; }
  test -f "$WS/.devcontainer/.env"   || echo "⚠ 无 .devcontainer/.env（代理可能未配，codex 可能连不上 chatgpt.com）"
  [ "$ok" = 1 ] && echo "✓ preflight 通过"
  [ "$ok" = 1 ]
}

clean() {
  echo "→ 清理本工作区遗留的 devcontainer 容器…"
  docker rm -f $(docker ps -aq --filter "label=devcontainer.local_folder=$WS") 2>/dev/null || true
}

up() {
  preflight
  load_env   # 让构建期能用上 .env 里的 HTTP_PROXY
  clean
  echo "→ devcontainer up（构建镜像 + 启动 + 跑 postCreate: npm ci）…"
  echo "  构建代理 HTTP_PROXY=${HTTP_PROXY:-<未设置>}"
  devcontainer up --workspace-folder "$WS"
  echo "✓ 容器就绪。接着可跑：proxy / shell / codex / task"
}

proxy() {
  echo "→ 容器内代理与连通性自检："
  dexec bash -lc '
    echo "HTTP_PROXY=$HTTP_PROXY"
    echo "HTTPS_PROXY=$HTTPS_PROXY"
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://chatgpt.com || echo 000)
    echo "GET https://chatgpt.com -> $code"
    [ "$code" != 000 ] && echo "✓ 能出网" || echo "✗ 连不上：检查宿主代理是否监听 0.0.0.0、端口是否对、.env 是否被加载"
  '
}

shell() { dexec bash; }

codex_once() {
  local prompt="${1:?用法: run-local.sh codex \"提示词\"}"
  dexec --remote-env PROMPT="$prompt" bash -lc '
    set -euo pipefail
    git config --global --add safe.directory /workspace
    printf "%s" "$PROMPT" | codex exec --sandbox workspace-write
  '
}

task() {
  local title="${1:?用法: run-local.sh task \"标题\" \"需求正文\"}"
  local body="${2:-}"
  dexec \
    --remote-env ISSUE_NUMBER="local" \
    --remote-env ISSUE_TITLE="$title" \
    --remote-env ISSUE_BODY="$body" \
    bash -lc '
      set -euo pipefail
      git config --global --add safe.directory /workspace
      test -f "$HOME/.codex/auth.json" || { echo "::error:: 缺 ~/.codex/auth.json"; exit 3; }

      printf "# Issue #%s: %s\n\n%s\n" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$ISSUE_BODY" > /tmp/task.md
      { cat .agent/harness/rules/panasset-instructions.md; echo; cat /tmp/task.md; } > /tmp/prompt.md

      echo "→ codex 执行任务（改代码）…"
      codex exec --sandbox workspace-write < /tmp/prompt.md

      echo "→ npm run build 验证…"
      npm run build

      echo "→ 改动如下（未提交，留给你检查）："
      git status --short
    '
}

case "${1:-}" in
  preflight) preflight ;;
  clean)     clean ;;
  up)        up ;;
  proxy)     proxy ;;
  shell)     shell ;;
  codex)     shift; codex_once "${1:-}" ;;
  task)      shift; task "${1:-}" "${2:-}" ;;
  *) sed -n '2,18p' "$0"; exit 1 ;;
esac
