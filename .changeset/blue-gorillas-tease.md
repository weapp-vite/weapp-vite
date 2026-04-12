---
'weapp-vite': patch
'@wevu/web-apis': patch
'create-weapp-vite': patch
---

修复小程序请求运行时按需注入缺失 `TextDecoder` 与 `TextEncoder` 的问题。现在 `fetch`、`Request`、`Response`、`XMLHttpRequest`、`WebSocket` 等链路会自动补齐文本编解码构造器，并在运行时 installer、局部自由变量绑定和最终 bundle 注入阶段保持一致，避免真实宿主里出现 `TextDecoder is not defined` 一类初始化错误；同时把共享 runtime marker 常量收敛到 `@weapp-core/constants`，统一跨包实现与测试约束。
