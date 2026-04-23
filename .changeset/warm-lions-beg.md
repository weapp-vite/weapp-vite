---
"weapp-vite": patch
"create-weapp-vite": patch
---

在开发态 HMR 慢样本提示里补充“疑似慢段”摘要，会优先指出 `watch->dirty`、`emit` 或 `shared` 哪一段相对近期均值回归最明显，帮助开发者在进入 `analyze --hmr-profile` 前先快速判断问题大致落点。
