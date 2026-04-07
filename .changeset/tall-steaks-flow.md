---
'create-weapp-vite': patch
'weapp-vite': patch
---

为 `weapp-vite` 的 request globals 自动注入链路补充 `WebSocket` 支持，并将 `socket.io-client` / `engine.io-client` 纳入默认依赖检测。现在小程序项目在依赖这些实时通信库时，构建产物会自动注入并绑定 `WebSocket`，降低 `socket.io-client` 在 shared chunk 与页面初始化阶段因缺失全局对象而启动失败的概率。
