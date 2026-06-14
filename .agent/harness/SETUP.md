# Agent Harness Setup

本仓库为 **公有 repo**，Agent 凭证不能放到 GitHub Secrets。
我们采用 **GitHub Actions + 本地 self-hosted runner** 方案：

- GitHub 负责触发（Issue label → workflow）和承载结果（PR、Pages）
- Agent 实际跑在你本地一台 self-hosted runner 上，凭证**从不离开本机**
- Pages 部署和 CI 仍在 GitHub-hosted runner 上执行（无需凭证）

Agent workflow **直接在 runner 宿主机**执行 `npm ci`、agent 任务、`npm run lint/build`，**不使用 devcontainer**。
本地调试请用 `.agent/harness/run-local.sh`，与线上一致。

---

## Agent 后端切换

通过 runner 本机环境变量 `AGENT_BACKEND` 选择后端（**默认 `cursor`**）：

| `AGENT_BACKEND` | CLI | 认证 |
|-----------------|-----|------|
| `cursor`（默认） | Cursor CLI（`agent`） | `CURSOR_API_KEY` |
| `codex` | Codex CLI（`codex exec`） | `~/.codex/auth.json`（`codex login`） |

可选环境变量：

| 变量 | 说明 |
|------|------|
| `CURSOR_AGENT_MODEL` | Cursor 模型，默认 `composer-2.5` |
| `AGENT_VERBOSE=1` | 透传完整 agent 输出 |
| `INSTALL_ALL_AGENT_BACKENDS=1` | `install-tools.sh` 时同时安装两套 CLI |

在 runner 的 `~/.bashrc`、systemd 单元或 launchd 环境里设置，例如：

```bash
export AGENT_BACKEND=cursor
export CURSOR_API_KEY="cursor_..."
export PATH="$HOME/.cursor/bin:$HOME/.local/bin:$PATH"
```

切回 Codex：

```bash
export AGENT_BACKEND=codex
# 确保已 codex login
```

---

## 一次性配置

### 1. 安装 Agent CLI（推荐 Cursor）

```bash
export AGENT_BACKEND=cursor   # 可省略，已是默认值
.agent/harness/install-tools.sh
```

或手动：

```bash
curl https://cursor.com/install -fsS | bash
# 在 Cursor Dashboard → Integrations 创建 API Key
export CURSOR_API_KEY="cursor_..."
```

**Codex 备选：**

```bash
export AGENT_BACKEND=codex
npm i -g @openai/codex
codex login
ls -l ~/.codex/auth.json
```

### 2. 安装并注册 self-hosted runner

在仓库页面：**Settings → Actions → Runners → New self-hosted runner**，按提示下载安装。
为了让 workflow 精确选到这台机器，注册时勾上自定义标签：

```
self-hosted, panasset-agent
```

把 runner 装在**已经配置好 `CURSOR_API_KEY`（或 `codex login`）的同一个用户账户下**。

### 3. Runner 主机依赖

- **Node.js 20+**（与 `agent-run.yml` 中 `setup-node` 一致）
- **Cursor CLI**（`agent`）或 **Codex CLI**（按 `AGENT_BACKEND`）
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

Cursor / Codex 运行时要访问外部 API。在 **runner 宿主机的 shell 环境**中配置代理（例如写入启动 runner 的 systemd 单元或 `~/.bashrc`）：

```bash
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1,::1,.local
```

要点：

- 代理需对本机进程可用；runner 以哪个用户运行，就在该用户环境里设置。
- 验证宿主机能出网（Cursor 示例）：
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' https://cursor.com
  ```

### 6. GitHub 仓库设置

- **Settings → Actions → General → Workflow permissions**：`Read and write permissions`
- **Settings → Pages → Source**：`GitHub Actions`
- **创建 PR 权限（二选一）**：
  1. **推荐（self-hosted）**：在 runner 宿主机执行 `gh auth login`，或在 runner 服务环境里设置 `GH_TOKEN`（fine-grained PAT，需 `Contents` + `Pull requests` + `Issues` 写权限）。workflow 会优先使用该 token，不受下方开关限制。
  2. **或**：**Settings → Actions → General** → 勾选 **Allow GitHub Actions to create and approve pull requests**（允许 `GITHUB_TOKEN` 开 PR）。
- 可选：在仓库 **Labels** 中创建 `ai-generated`（没有也能开 PR，只是不会自动打标）、`release`（合并前打上才会自动发布）。
- 可选 secret（仅当 Agent 任务需要访问外部 API）：`GEMINI_API_KEY`、`ALPHAVANTAGE_API_KEY`

---

## 触发方式

1. 用 `AI Task` Issue 模板新建 Issue（默认带 `ai-task` label）
2. `agent-run.yml` 被触发 → 在 self-hosted runner **宿主机**上执行
3. Agent 读取 `.github/agent-instructions.md` + Issue 内容改代码 → `lint` / `build` → 路径校验 → commit
4. 推分支 `ai/{issue}-{slug}` → 开/更新 PR（`ai-generated` label，描述含变更与验证摘要）
5. `agent-review.yml` 同样在 self-hosted runner 上自动 review PR
6. 你 review 通过后，在 PR 上打 `release` 标签，再由 owner merge → `release-on-merge.yml` 自动打日期标签（如 `v2026.06.15.1`）→ `deploy-pages.yml` 构建并部署 GitHub Pages（未打 `release` 的 merge 不会上线）

同一 Issue 重复触发时，workflow 的 `concurrency` 会取消进行中的旧 run，避免分支互相覆盖。

---

## 本地调试

```bash
.agent/harness/run-local.sh preflight
.agent/harness/run-local.sh probe "say hi"
.agent/harness/run-local.sh task "测试标题" "需求描述"
```

`task` 与 `agent-run.yml` 使用同一份 `.github/agent-instructions.md`，并执行 `lint` + `build` + 路径校验。

## 观察 Agent 输出

- **Actions 网页**：`Run agent` 步骤默认只打印 Agent 最终总结（中间过程写入 `/tmp/agent.log`）
- **完整日志**：Actions run 页 → **Artifacts** → 下载 `agent-log-issue-*`
- **本地 verbose**：`AGENT_VERBOSE=1 .agent/harness/run-local.sh task "标题" "需求"`

---

## 安全模型

- Agent 凭证仅存在于 self-hosted runner 主机（`CURSOR_API_KEY` 或 `~/.codex/auth.json`）
- Agent **不能**通过路径 gate 修改 `.github/workflows/`、`.cursor/`、agent 指令文件、`.env`
- 公有仓库的 PR / Issue 触发的 workflow 默认**不会**注入仓库 secrets 到 fork 来源的 PR，但本方案不依赖 secrets 已天然规避
- 仅 repo owner 贴 `ai-task` label 才会触发 agent（见 workflow `if` 条件）

## 关闭 / 暂停

- 暂停接单：到 Runner 设置里 `Stop` 服务，或在 repo Settings 里 `Disable` 该 runner
- 永久关闭：删除 self-hosted runner 注册，删除 `agent-run.yml` / `agent-review.yml`
