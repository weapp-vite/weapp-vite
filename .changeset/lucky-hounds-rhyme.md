---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发态终端输入冲突：当 `wv dev` 的快捷键与微信开发者工具登录失效后的“按 r 重试”交互同时存在时，统一由共享输入协调器管理 `stdin`，避免 DevTools 重试按键被外层热键错误拦截。
