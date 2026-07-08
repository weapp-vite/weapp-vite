---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 request-global 注入在小程序 Linux 环境下会通过 `WebSocket` 构造探测触发真实 socket 错误，并停止在 `.vue` 源码阶段注入 request globals，避免污染 wevu 生成结果与放大运行时 `setData` 数据量。
