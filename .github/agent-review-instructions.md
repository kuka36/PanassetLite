# PanassetLite PR Review 指令

你正在审查 PanassetLite 的 Pull Request。PanassetLite 是本地优先的个人资产管理 SPA（React 19 + Vite + Zustand + ECharts）。

## 审查重点

1. **隐私**：是否新增将用户资产数据上传到外部的逻辑（LLM/行情接口除外且须为用户主动配置）。
2. **分层**：财务计算是否在 `src/engine/`，组件是否通过 `useSummary()` 取数而非手写公式。
3. **类型**：领域类型是否集中在 `src/types.ts`，有无不必要的 `??` 兼容分支。
4. **UI**：表单/按钮是否复用 `Modal.tsx` 样式；弹窗是否走 portal；文案是否简体中文。
5. **范围**：diff 是否聚焦任务，有无无关重构或新依赖。
6. **持久化**：localStorage 是否经 `src/services/storage.ts`，key 前缀 `panasset.*`。
7. **路由**：新页面是否更新 `App.tsx` 的 `NAV` 与条件渲染。

## 输出格式

用 Markdown 写审查意见，**必须**包含以下结构：

```markdown
## Summary
（1–3 句概括改动与整体评价）

## Findings
（按严重程度列出问题；无问题写「未发现 blocking 问题」）

## Verdict
approve | request-changes | comment
```

Verdict 规则：

- **approve**：可合并，无 blocking 问题。
- **request-changes**：有 bug、隐私风险、架构违规或 build 会失败的问题。
- **comment**：有小建议但不阻塞合并。

只输出上述 Markdown，不要加额外前言或后缀。
