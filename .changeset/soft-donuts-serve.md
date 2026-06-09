---
"weapp-vite": patch
---

修复微信多端项目构建后缺少 `app.miniapp.json` 的问题。存在项目根 `project.miniapp.json` 时，构建产物会同步生成运行时需要读取的 `app.miniapp.json`。
