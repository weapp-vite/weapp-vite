# AGENTS Guidelines for dashboard-ui-lab

本目录是 `@weapp-vite/dashboard` 的真实 UI 验证项目。开发或优化 dashboard 页面时，优先使用本 app 反馈真实 analyze payload 和 CLI UI 链路，不要只启动 `packages/dashboard` 的包级 Vite dev server 作为最终判断依据。

## Required Workflow

- 修改 `packages/dashboard/src/**` 后，通过本 app 验证前先同步 dashboard 构建产物：
  - `pnpm --filter @weapp-vite/dashboard build`
- 启动真实联调页面：
  - `pnpm --filter dashboard-ui-lab dev:ui`
- 如需验证生产态 UI：
  - `pnpm --filter dashboard-ui-lab build:ui`
- 包级 `pnpm --filter @weapp-vite/dashboard dev` 只允许用于组件空态或快速样式排查，不能作为 dashboard 页面优化的最终验收入口。

## Validation Notes

- `dev:ui` 是首选本地反馈路径，因为它会通过 `wv dev --ui` 注入 dashboard 所需的真实分析上下文。
- 页面优化必须在本 app 启动后查看可访问地址，再根据实际渲染调整布局、文字密度、状态区和响应式表现。
- 如果 dashboard 源码在同一工作轮次再次变更，重新运行 `pnpm --filter @weapp-vite/dashboard build` 后再刷新或重启本 app 验证。
