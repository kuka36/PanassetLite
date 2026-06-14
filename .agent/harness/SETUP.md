# Agent Harness Setup

本仓库为 **公有 repo**，ChatGPT 登录凭证（`~/.codex/auth.json`）不能放到 GitHub Secrets。
我们采用 **GitHub Actions + 本地 self-hosted runner** 方案：

- GitHub 负责触发（Issue label → workflow）和承载结果（PR、Pages）
- Codex 实际跑在你本地一台 self-hosted runner 上，凭证文件**从不离开本机**
- Pages 部署和 CI 仍在 GitHub-hosted runner 上执行（无需凭证）

Agent workflow **直接在 runner 宿主机**执行 `npm ci`、`codex exec`、`npm run lint/build`，**不使用 devcontainer**。
本地调试请用 `.agent/harness/run-local.sh`，与线上一致。

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

- **Node.js 20+**（与 `agent-run.yml` 中 `setup-node` 一致）
- **Codex CLI**（`npm i -g @openai/codex`，或运行 `.agent/harness/install-tools.sh`）
- `git`、`gh`

首次在仓库根目录执行一次 `npm ci`，确认依赖可安装。

### 4. 后台常驻 runner

```bash
cd actions-runner
./run.sh              # 前台跑，验证一次
# 验证通过后用 svc 安装为后台服务：
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5. 代理（国内网络必需）

Codex 运行时要访问 `chatgpt.com`。在 **runner 宿主机的 shell 环境**中配置代理（例如写入启动 runner 的 systemd 单元或 `~/.bashrc`）：

```bash
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1,::1,.local
```

要点：

- 代理需对本机进程可用；runner 以哪个用户运行，就在该用户环境里设置。
- 验证宿主机能出网：
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' https://chatgpt.com
  ```

### 6. GitHub 仓库设置（无需任何 secret）

- **Settings → Actions → General → Workflow permissions**：`Read and write permissions`
- **Settings → Pages → Source**：`GitHub Actions`
- 可选 secret（仅当 Agent 任务需要访问外部 API）：`GEMINI_API_KEY`、`ALPHAVANTAGE_API_KEY`

---

## 触发方式

1. 用 `AI Task` Issue 模板新建 Issue（默认带 `ai-task` label）
2. `agent-run.yml` 被触发 → 在 self-hosted runner **宿主机**上执行
3. Codex 读取 `.github/agent-instructions.md` + Issue 内容改代码 → `lint` / `build` → 路径校验 → commit
4. 推分支 `ai/{issue}-{slug}` → 开/更新 PR（`ai-generated` label，描述含变更与验证摘要）
5. `agent-review.yml` 同样在 self-hosted runner 上自动 review PR
6. 你 review/merge → `deploy-pages.yml` 在 GitHub-hosted runner 上构建并部署

同一 Issue 重复触发时，workflow 的 `concurrency` 会取消进行中的旧 run，避免分支互相覆盖。

---

## 本地调试

```bash
.agent/harness/run-local.sh preflight
.agent/harness/run-local.sh task "测试标题" "需求描述"
```

`task` 与 `agent-run.yml` 使用同一份 `.github/agent-instructions.md`，并执行 `lint` + `build` + 路径校验。

---

## 安全模型

- ChatGPT 凭证仅存在于 self-hosted runner 主机的 `~/.codex/auth.json`
- Agent **不能**通过路径 gate 修改 `.github/workflows/`、`.cursor/`、agent 指令文件、`.env`
- 公有仓库的 PR / Issue 触发的 workflow 默认**不会**注入仓库 secrets 到 fork 来源的 PR，但本方案不依赖 secrets 已天然规避
- 仅 repo owner 贴 `ai-task` label 才会触发 agent（见 workflow `if` 条件）

## 关闭 / 暂停

- 暂停接单：到 Runner 设置里 `Stop` 服务，或在 repo Settings 里 `Disable` 该 runner
- 永久关闭：删除 self-hosted runner 注册，删除 `agent-run.yml` / `agent-review.yml`
