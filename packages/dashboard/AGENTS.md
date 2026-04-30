# AGENTS Guidelines for @weapp-vite/dashboard

本目录是 `weapp-vite` 的 Web Analyze Dashboard 包。它不是小程序运行时包，Vue SFC 类型检查必须按浏览器 Vue 应用处理。

## Required Checks

- 修改 `packages/dashboard/src/**`、`packages/dashboard/tsconfig.json` 或本包构建配置后，至少运行：
  - `pnpm --filter @weapp-vite/dashboard typecheck`
  - `pnpm --filter @weapp-vite/dashboard lint`
  - `pnpm --filter @weapp-vite/dashboard lint:styles`
- 提交前可使用聚合命令：
  - `pnpm --filter @weapp-vite/dashboard check`
- `typecheck` 使用 `vue-tsc`，不要用普通 `tsc` 作为 Vue SFC 的最终类型检查依据。

## Vue Type Configuration Guard

- `tsconfig.json` 必须保留浏览器 DOM lib：
  - `ESNext`
  - `DOM`
  - `DOM.Iterable`
- `vueCompilerOptions` 必须保持 Web Vue 配置：
  - `plugins: []`
  - `lib: "vue"`
- 不要让根目录面向小程序/wevu 的 Volar 插件配置泄漏到本包，否则模板里的 `div`、`button`、`select`、`table` 等 Web 标签会被错误地按小程序组件检查。

## Real UI Validation

- 页面布局、交互或 Analyze 数据展示变更，必须在 `apps/dashboard-ui-lab` 里验证真实链路。
- 在启动或刷新 `dashboard-ui-lab` 前，先同步本包产物：
  - `pnpm --filter @weapp-vite/dashboard build`
- 真实联调入口：
  - `pnpm --filter dashboard-ui-lab dev:ui`
  - `http://127.0.0.1:5173/analyze`
- 包级 `pnpm --filter @weapp-vite/dashboard dev` 只能用于空态或组件局部排查，不能作为最终验收入口。
