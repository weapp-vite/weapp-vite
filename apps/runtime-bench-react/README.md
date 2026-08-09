# runtime-bench-react

React 19 小程序运行时 benchmark 基准工程。

动态基准与 `runtime-bench-native`、`runtime-bench-vue` 使用相同的卡片数据和更新轮次；静态基准单独测量固定 host shape 的 binding slot 更新，不与动态卡片负载混算。

```bash
pnpm --filter runtime-bench-react build
pnpm --filter runtime-bench-react typecheck
pnpm e2e:runtime-bench
```

真实 DevTools 基准会按 Native、Wevu、React 顺序串行执行，并把每个成功项目的结果保存到当前提交对应的 `.tmp/runtime-bench/checkpoints/`。若后续项目因 DevTools 会话抖动失败，可在环境恢复后续跑：

```bash
pnpm e2e:runtime-bench -- --resume
```

恢复模式只复用同一 Git commit、同一 runtime provider 的成功 checkpoint，不会跨代码版本混用结果。每个样本遇到可恢复的 `reLaunch` / session 错误时会重连一次 automator，并从该样本起点重新采样。
