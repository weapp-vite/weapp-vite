---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复原生 layout 模板引入共享 `template`、`include` 与 `wxs`/`sjs` 文件时的热更新传播。现在当 layout 自身或其依赖的共享模板脚本模块保存后，所有使用该 layout 的原生页面都能正确重新生成，并覆盖真实 IDE 运行态下的回归场景。
