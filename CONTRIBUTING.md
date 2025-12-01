# Contributing to PanassetLite

## 这份仓库当前最适合的工作方式

PanassetLite 现在更像 **持续演进中的单仓前端产品**：
- 主体是 React + TypeScript + Vite
- 当前没有自动化测试体系
- 已有 GitHub Pages 发布链路（`npm run deploy`）
- `main` 已承载真实开发历史，且本地分支领先远端较多

所以这里不适合上来就套重型 GitFlow。更合适的是：
**trunk-based 的简化变体：`main` + 短命功能分支 + PR 合并 + 必要时 hotfix 分支。**

---

## 1. 分支策略

### 主分支
- `main`：唯一长期主分支，保持“随时可构建、可发布”

### 短命分支
从 `main` 拉出，完成后尽快合并，不长期挂着。

推荐命名：
- `feat/<topic>`：新功能
- `fix/<topic>`：Bug 修复
- `refactor/<topic>`：重构
- `docs/<topic>`：文档
- `chore/<topic>`：杂项维护
- `hotfix/<topic>`：线上紧急修复

示例：
- `feat/asset-tag-filter`
- `fix/market-refresh-cache`
- `refactor/portfolio-engine-split`

### 不建议
- 不再新增长期 `develop` 分支
- 不保留大而长期的功能分支
- 不在一个分支里混做“功能 + 重构 + 文档 + 发布”

---

## 2. 提交规范

使用 **Conventional Commits**，但保持务实，不搞过度仪式化。

格式：
```bash
<type>(<scope>): <summary>
```

常用类型：
- `feat`：新功能
- `fix`：修复
- `refactor`：重构
- `docs`：文档
- `chore`：构建、依赖、配置维护
- `perf`：性能优化
- `style`：纯样式或格式调整
- `revert`：回滚

推荐 scope：
- `assets`
- `analytics`
- `portfolio`
- `market-data`
- `ai`
- `storage`
- `build`
- `docs`

示例：
```bash
feat(assets): 支持资产标签筛选持久化
fix(market-data): 避免汇率刷新失败时覆盖缓存
refactor(portfolio): 拆分持仓计算与状态持久化逻辑
docs(workflow): 增加 Git 与 GitHub 协作规范
```

### 提交边界
一条 commit 只做一件事：
- 不把无关文件顺手塞进去
- 不把格式化噪音和真实逻辑变更混在一起
- 大重构拆成可审阅的小提交

---

## 3. PR 流程

### 默认流程
1. 从 `main` 拉新分支
2. 在本地完成开发
3. 本地先跑最小检查：
   ```bash
   npm run build
   ```
4. 推到 GitHub，发 PR 到 `main`
5. PR 描述写清：背景、改动、风险、验证方式
6. 检查通过后 squash merge 或 rebase merge

### PR 大小建议
- 优先小 PR：**300 行以内有效改动**最佳
- 超过 600 行的 PR，除非是明确的大型重构，否则应拆分

### 合并策略
当前推荐：
- **默认 squash merge**：保持 `main` 历史干净
- 若一组 commits 本身就表达清楚演进过程，可用 rebase merge
- 不建议 merge commit 作为默认方式

---

## 4. Issue 管理

仓库现在适合轻量 Issue 管理，而不是复杂项目管理系统。

建议最少保留三类：
- `bug`
- `feature`
- `refactor`

每个 issue 至少写清：
- 背景 / 问题
- 目标结果
- 是否影响发布
- 是否需要数据迁移 / 配置变更

推荐标签：
- `bug`
- `feature`
- `refactor`
- `docs`
- `ai`
- `market-data`
- `priority:high`
- `release:blocker`

### Issue 与 PR 关系
- 能对应 issue 的 PR，尽量在描述里引用：`Closes #123`
- 小修复可直接 PR，但涉及产品行为变化的改动尽量先有 issue

---

## 5. 发布 / 版本管理

### 当前现实
- 仓库已配置 GitHub Pages 发布
- `package.json` 版本仍是 `0.0.0`
- 目前还不适合引入复杂 release train

### 推荐策略
先使用 **轻量 SemVer**：
- `0.x.y` 阶段
- `x`：有明显产品能力扩展或不兼容调整
- `y`：日常修复与小迭代

建议从下一个正式可演示版本开始：
- `0.1.0`：工作流落地后的第一个可对外稳定演示版

### 发布动作
每次发布：
1. 合并到 `main`
2. 确认 CI 通过
3. 更新版本号与变更说明
4. 打 tag，例如：`v0.1.0`
5. 再执行发布（GitHub Pages）

### 暂时不要做的事
- 不要现在就上自动语义发版
- 不要同时维护多个长期发布分支

---

## 6. CI 检查建议

当前仓库缺测试，最小 CI 应先保证“不会把坏构建合进 main”。

### 现在就该做
- `npm ci`
- `npm run build`

### 后续可选增强
- `tsc --noEmit` 单独检查
- ESLint / Prettier
- Vitest 单元测试
- 关键页面 smoke test

当前原则：
**先把构建守住，再逐步补测试。**

---

## 7. Hotfix 流程

适用于：线上 GitHub Pages 已发布版本出现明显问题。

流程：
1. 从当前 `main` 或最近发布 tag 拉 `hotfix/<topic>`
2. 只修复单一线上问题
3. 本地跑 `npm run build`
4. 发小 PR，优先审查
5. 合并后立即发布
6. 补 release note

要求：
- hotfix 不夹带重构
- hotfix 不顺手做功能增强

---

## 8. 代码评审规则

评审重点按优先级排序：
1. **正确性**：会不会算错资产、价格、盈亏、持仓
2. **数据安全**：会不会破坏 localStorage、迁移、导入导出
3. **回归风险**：是否影响 AI、行情刷新、核心页面
4. **可维护性**：是否继续把超大模块变得更重
5. **性能**：是否放大首屏 bundle 或重复计算

### 对这个项目特别要盯的点
- `PortfolioContext` 是否继续膨胀
- `marketData.ts` 是否继续堆职责
- 资产计算逻辑是否绕过 `PortfolioEngine`
- 新功能是否引入新的本地存储 key 且无迁移说明
- 是否无意暴露 API key 或增加前端敏感配置泄露面

---

## 9. 与 AI / Codex 协作约束

AI 可以加速，但不能直接替代仓库判断。

### AI 可以做
- 起草 PR / issue / 文档
- 写局部功能
- 做重构草案
- 先做第一轮代码审查
- 补测试与类型修复

### AI 不应直接做
- 未经确认就改发布流程
- 批量改动存储结构却不写迁移说明
- 未验证就声称“已修复”
- 在一个提交里混入大范围无关改动

### 使用 AI 的最低要求
AI 产出的改动在提交前必须满足：
- 能解释为什么这样改
- 本地至少通过 `npm run build`
- 改动范围与任务目标一致
- 若涉及架构层影响，PR 描述里写出风险点

### AI 生成代码的提交建议
如果某次改动主要由 AI 辅助完成，可在 PR 描述中标注：
- 使用了 AI 辅助
- 人类已复核哪些部分
- 哪些地方仍需重点 review

---

## 10. 现在就执行 vs 后续优化

### 现在就执行
- 以 `main` 作为唯一长期分支
- 新开发全部走短命分支
- 提交改用 Conventional Commits
- 所有合并通过 PR 进入 `main`
- 建立最小 CI：`npm ci` + `npm run build`
- 发布时打 tag

### 后续可选优化
- 增加 ESLint / Prettier
- 增加 Vitest
- 增加 preview deployment
- 引入 changeset / release-please
- 视多人协作程度再决定是否引入 CODEOWNERS

---

## 11. 推荐日常命令

```bash
git checkout main
git pull origin main
git checkout -b feat/your-topic

# 开发完成后
npm run build
git status
git add .
git commit -m "feat(scope): summary"
git push -u origin feat/your-topic
```
