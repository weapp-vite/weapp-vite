---
"weapp-vite": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复原生小程序组件作用域插槽产物、GitHub issue 运行时用例启动恢复、以及 IDE HMR 场景中的 DevTools 缓存恢复稳定性，确保 `pnpm e2e:ide:full` 全量验证可以稳定通过。
