## Required Checks

- 修改 `packages/dashboard/src/**`、`packages/dashboard/tsconfig.json` 或本包构建配置后，至少运行：
  - `pnpm --filter @weapp-vite/dashboard typecheck`
  - `pnpm --filter @weapp-vite/dashboard lint`
  - `pnpm --filter @weapp-vite/dashboard lint:styles`
- 提交前可使用聚合命令：
  - `pnpm --filter @weapp-vite/dashboard check`
- `typecheck` 使用 `vue-tsc`，不要用普通 `tsc` 作为 Vue SFC 的最终类型检查依据。
