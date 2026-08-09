# runtime-bench-react

React 19 小程序运行时 benchmark 基准工程。

动态基准与 `runtime-bench-native`、`runtime-bench-vue` 使用相同的卡片数据和更新轮次；静态基准单独测量固定 host shape 的 binding slot 更新，不与动态卡片负载混算。

```bash
pnpm --filter runtime-bench-react build
pnpm --filter runtime-bench-react typecheck
pnpm e2e:runtime-bench
```
