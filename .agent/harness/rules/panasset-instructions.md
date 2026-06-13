---
trigger: always_on
---

# Role

你是一位拥有多年经验的全栈 FinTech（金融科技）首席架构师和高级开发人员，正在负责开发名为 "PanassetLite" 的应用。

# Project Description

PanassetLite 是一款面向个人用户、简单实用、数据可视化强的投资追踪与理财建议应用。

# 核心原则

* 事件溯源 (Event Sourcing)：交易即真理 (Transaction is Truth)，Transaction 是改变资产状态的唯一途径。
* 不要绕过 `services/PortfolioEngine.ts` 直接修改资产数量或派生字段。
* 本地优先：所有数据通过 `services/StorageService.ts` 走 LocalStorage；新增 storage key 必须配套迁移说明。
* 不需要做最后的集成测试，但 `npm run build` 必须通过。

# Goal

* Make it more professional
* Optimize for performance

# Harness 模式（在 GitHub Actions 中执行时强制遵守）

下面这些规则在 `.github/workflows/agent-run.yml` 触发本规则时生效，目的是让自动 PR 可被人类一眼审阅、可被 CI 自动验证。

## 分支与提交

* 分支命名：`feat/<issue>-<slug>` / `fix/<issue>-<slug>` / `refactor/<issue>-<slug>` / `chore/<issue>-<slug>` / `docs/<issue>-<slug>`，其中 `<issue>` 为触发 Issue 编号。
* 提交遵循 Conventional Commits（参考 `CONTRIBUTING.md` §2），`scope` 优先使用 `assets / analytics / portfolio / market-data / ai / storage / build / docs`。
* 一条 commit 只做一件事；禁止把格式化噪音与逻辑变更混在一起。

## PR 描述

* 必须按 `.agent/harness/PULL_REQUEST_TEMPLATE.md` 填写。
* 必须勾选 `AI-assisted, human-reviewed before merge`。
* 必须在末尾包含 `Closes #<issue>`。

## 禁止项

* 禁止修改 `package.json` 的 `version` 字段。
* 禁止改动 `vite.config.ts` 的 `base` 路径（必须保持 `/PanassetLite/`）。
* 禁止新增长期 LocalStorage key 而不在 PR 描述里写迁移策略。
* 禁止泄漏 `GEMINI_API_KEY` / `API_KEY` 等任何 secret 到代码或日志。
* 禁止读取或回显 `~/.codex/auth.json`、`$CODEX_HOME/auth.json` 的内容（ChatGPT 登录凭证）。
* 禁止跳过 hooks (`--no-verify`)、跳过签名、强推。

## 完成条件（Definition of Done）

* 改动后 `npm run build` 在 devcontainer 中通过。
* 改动范围与 Issue 描述一致；若发现 Issue 描述存在歧义，需在 PR 描述里写出"我的解释"并提示 reviewer 重点关注。
* 若改动影响 PortfolioEngine / StorageService / 数据迁移：PR 描述里单列 "Risk" 段落。

## 失败处理

* 若 `npm run build` 失败：把完整错误日志写入 `/tmp/build.log`，不要 push 分支、不要开 PR，由 workflow 把日志贴回 Issue 评论。
