---
'weapp-vite': patch
'create-weapp-vite': patch
---

调整 request globals 的默认自动注入策略，改为按源码与产物中的实际引用按需注入。现在只有在实际使用 `fetch` 相关能力时才会注入请求运行时那组依赖，只有在实际使用 `WebSocket` 时才会注入 `WebSocket` 兼容层，同时保持入口、公共 chunk 与 app prelude 的注入目标一致。
