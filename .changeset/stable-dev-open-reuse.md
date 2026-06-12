---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复反复执行 `wv dev -o` 时会无条件关闭并重开微信开发者工具的问题。现在 dev 启动期会优先复用并刷新已打开的目标项目，只有手动触发重开动作时才关闭当前窗口，减少连续启动/关闭后的 DevTools 连接抖动。
