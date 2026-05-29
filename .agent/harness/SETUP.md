# Agent Harness Setup

本仓库为 **公有 repo**，ChatGPT 登录凭证（`~/.codex/auth.json`）不能放到 GitHub Secrets。
我们采用 **GitHub Actions + 本地 self-hosted runner** 方案：

- GitHub 负责触发（Issue label → workflow）和承载结果（PR、Pages）
- Codex 实际跑在你本地一台 self-hosted runner 上，凭证文件**从不离开本机**
- Pages 部署和 CI 仍在 GitHub-hosted runner 上执行（无需凭证）

---

## 一次性配置

### 1. 本地登录 Codex CLI

```bash
npm i -g @openai/codex
codex login            # 浏览器走 ChatGPT OAuth
ls -l ~/.codex/auth.json
```

### 2. 安装并注册 self-hosted runner

在仓库页面：**Settings → Actions → Runners → New self-hosted runner**，按提示下载安装。
为了让 workflow 精确选到这台机器，注册时勾上自定义标签：

```
self-hosted, panasset-agent
```

把 runner 装在**已经执行过 `codex login` 的同一个用户账户下**，这样 `$HOME/.codex/auth.json` 直接可用。

### 3. Runner 主机依赖

- Docker（`devcontainers/ci` action 需要本地 docker 守护进程）
- Node.js 20+（容器内自带；宿主上建议也装一份用于本地开发）
- `git`、`gh`

### 4. 后台常驻 runner

```bash
cd actions-runner
./run.sh              # 前台跑，验证一次
# 验证通过后用 svc 安装为后台服务：
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5. 代理（国内网络必需）

Codex 运行时要访问 `chatgpt.com`，容器内通常需要走宿主的代理。配置**不写进 git**，
放在 runner 本机的 `.devcontainer/.env`（devcontainer.json 通过 `--env-file` 加载）：

```ini
# .devcontainer/.env —— 各 runner 各自配置，端口按本机代理实际值改
HTTP_PROXY=http://host.docker.internal:7897
HTTPS_PROXY=http://host.docker.internal:7897
http_proxy=http://host.docker.internal:7897
https_proxy=http://host.docker.internal:7897
NO_PROXY=localhost,127.0.0.1,::1,.local
no_proxy=localhost,127.0.0.1,::1,.local
```

要点：
- 容器内 `host.docker.internal` 代表宿主，**不能用 `127.0.0.1`**（那是容器自己）。
- **宿主代理必须监听 `0.0.0.0`**，否则容器连不进来（默认只听 `127.0.0.1`）。
  - Clash / Clash Verge：打开 **Allow LAN / 允许局域网连接**。
  - Trojan-Qt5：偏好设置 → **Inbound/入站设置** → 把 **本地地址(Local Address) 从 `127.0.0.1` 改成 `0.0.0.0`**，
    并勾选 **允许来自局域网的连接 / Share over LAN**；用它的 **HTTP 入站端口**填到上面的 `HTTP_PROXY`
    （Trojan-Qt5 的 HTTP/SOCKS 端口与 Clash 的 7897 未必相同，以本机实际为准）。改完重启代理。
- 验证容器内能出网（在 runner 宿主执行，端口换成实际值）：
  ```bash
  docker run --rm curlimages/curl -x http://host.docker.internal:7897 \
    -sS -o /dev/null -w '%{http_code}\n' https://chatgpt.com
  ```

### 6. GitHub 仓库设置（无需任何 secret）

- **Settings → Actions → General → Workflow permissions**：`Read and write permissions`
- **Settings → Pages → Source**：`GitHub Actions`
- 可选 secret（如果要让 Codex 在容器里访问外部 API）：`GEMINI_API_KEY`、`ALPHAVANTAGE_API_KEY`

---

## 触发方式

1. 用 `AI Task` Issue 模板新建 Issue（默认带 `ai-task` label）
2. `agent-run.yml` 被触发 → 跑在你的 self-hosted runner 上
3. devcontainer 启动，`~/.codex` 通过 `.devcontainer/devcontainer.json` 的 `mounts` 注入容器
4. Codex 执行任务 → 推分支 → 开 PR（`ai-generated` label）
5. `agent-review.yml` 同样在 self-hosted runner 上自动 review PR
6. 你 review/merge → `deploy-pages.yml` 在 GitHub-hosted runner 上构建并部署

---

## 安全模型

- ChatGPT 凭证仅存在于 self-hosted runner 主机的 `~/.codex/auth.json`
- 公有仓库的 PR / Issue 触发的 workflow 默认**不会**注入仓库 secrets 到 fork 来源的 PR，但本方案不依赖 secrets 已天然规避
- `.agent/harness/rules/panasset-instructions.md` 已禁止 Codex 读取或回显 `~/.codex/auth.json`
- 任何人都可以新建 Issue 并贴 `ai-task` label —— 建议把贴 label 的权限限制在 collaborators（**Settings → Moderation → Code review limits**，或用 branch protection + 仅维护者可加 label）

## 关闭 / 暂停

- 暂停接单：到 Runner 设置里 `Stop` 服务，或在 repo Settings 里 `Disable` 该 runner
- 永久关闭：删除 self-hosted runner 注册，删除三个 `agent-*.yml` 文件
