---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

优化微信开发者工具缺少 engine build 接口时的错误处理，避免将 DevTools 返回的 HTML 404 原样暴露为构建失败，并在打开 IDE 时跳过不兼容的自动刷新步骤。
