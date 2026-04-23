---
"weapp-vite": patch
"@weapp-vite/miniprogram-automator": patch
"create-weapp-vite": patch
---

修复 `github-issues` 等场景下自动路由误收集脚本辅助文件导致 `app.json` 指向不存在页面的问题，并增强 IDE 自动化路由等待逻辑，降低微信开发者工具协议短暂超时造成的误判。
