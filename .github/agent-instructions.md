# PanassetLite Agent 指令

你是 PanassetLite 仓库的自动化开发 Agent。PanassetLite 是一款**本地优先**的个人资产管理 SPA（React 19 + Vite + Tailwind CSS v4 + Zustand + ECharts + TypeScript）。

## 核心约束

- **数据仅存浏览器**：Zustand persist / localStorage，无后端、无注册、无上传。除用户主动配置的 LLM/行情接口外，不得新增将资产明细发送到外部的逻辑。
- **UI 文案简体中文**；代码注释可中可英。
- **最小 diff**：只改任务相关代码，不顺手重构、不加无关功能。
- **不引入新依赖**，除非现有栈无法合理解决且收益明确。
- **不叠兼容层**：字段语义以 `src/types.ts` 为准，在表单/store 入口校验，不在 `engine/` 里 `value ?? amount`。

## 分层职责

| 层 | 目录 | 职责 |
|---|---|---|
| 页面 | `src/pages/` | 布局、交互；不写财务计算 |
| 组件 | `src/components/` | 可复用 UI 与表单 |
| 状态 | `src/store.ts` | 增删改 + 持久化入口 |
| 计算 | `src/engine/` | 纯函数/类，事件重放推导组合状态 |
| 服务 | `src/services/` | localStorage、行情、LLM 等 I/O |
| 类型 | `src/types.ts` | 领域模型、标签/颜色映射 |

页面通过 `useStore` 读写数据，通过 `useSummary()` 获取组合快照。**不要在组件内手写市值/盈亏公式。**

## UI 约定

- 按钮/表单样式从 `src/components/Modal.tsx` 导入：`btnPrimary`、`btnGhost`、`inputCls`、`labelCls`。
- 弹窗/全屏层优先复用 `Modal`（内置 portal）；`fixed` 勿直接放在带 `transform` 动画的容器内。
- 金额/百分比用 `src/utils/format.ts`（`fmtMoney`、`fmtPct`、`pnlColor`）。
- 新页面：同步更新 `src/App.tsx` 的 `NAV` 数组与 `<main>` 条件渲染（无 react-router）。

## 验证（硬性门禁）

**在宣布任务完成之前**，必须在仓库根目录执行并确保**两项均 exit 0**：

```bash
npm run lint
npm run build
```

- 任一项失败则任务**未完成**；须修复后重新运行，直至全部通过。
- 错误可能出现在你未改动的文件（仓库基线问题）；仍须修复，否则 CI 与 Agent Run 会失败。
- 若 UI 有改动，在 PR 描述中说明需手动验证的路径。

## 输出

- 实现 issue 中的目标，满足全部验收标准。
- 不要修改 `.github/workflows`、`.cursor/rules` 或与任务无关的文件。
- 用户可见错误用 `throw new Error('中文说明')`。
