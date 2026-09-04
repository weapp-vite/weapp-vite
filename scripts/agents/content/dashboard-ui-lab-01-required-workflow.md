## Required Workflow

- 修改 `packages/dashboard/src/**` 后，通过本 app 验证前先同步 dashboard 构建产物：
  - `pnpm --filter @weapp-vite/dashboard build`
- 启动真实联调页面：
  - `pnpm --filter dashboard-ui-lab dev:ui`
- 如需验证生产态 UI：
  - `pnpm --filter dashboard-ui-lab build:ui`
- 包级 `pnpm --filter @weapp-vite/dashboard dev` 只允许用于组件空态或快速样式排查，不能作为 dashboard 页面优化的最终验收入口。
