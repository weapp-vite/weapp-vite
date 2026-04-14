---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv dev -o` 复用已打开微信开发者工具窗口时可能继续命中旧模块缓存的问题。现在开发态打开同一项目时会主动重开 DevTools，以刷新最新构建产物，避免构建已更新但 IDE 仍报旧 chunk / 旧依赖错误。
