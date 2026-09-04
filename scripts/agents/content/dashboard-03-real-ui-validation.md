## Real UI Validation

- 页面布局、交互或 Analyze 数据展示变更，必须在 `apps/dashboard-ui-lab` 里验证真实链路。
- 在启动或刷新 `dashboard-ui-lab` 前，先同步本包产物：
  - `pnpm --filter @weapp-vite/dashboard build`
- 真实联调入口：
  - `pnpm --filter dashboard-ui-lab dev:ui`
  - 终端输出的 dashboard URL，包级 dashboard 默认从 `http://127.0.0.1:6188/analyze` 起，如果端口被占用会自动递增。
- 包级 `pnpm --filter @weapp-vite/dashboard dev` 只能用于空态或组件局部排查，不能作为最终验收入口。
