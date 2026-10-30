---
"@wevu/web-apis": minor
"wevu": minor
"weapp-vite": minor
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"create-weapp-vite": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
---

feat: 支持在微信小程序中使用 Fetch 响应流和 EventSource。

`@wevu/web-apis` 与 `wevu` 支持增量 UTF-8 解码、标准流消费和取消，以及 SSE 事件解析与重连，可复用 Web 的 Fetch 响应流和 `EventSource` 写法。

`weapp-vite` 在第三方模块执行前注入所需构造器，避免依赖在初始化时找不到相关 API。

宿主缺少早期真实 HTTP 状态码或分块 API 时，会明确报告能力限制；普通缓冲请求和现有 Wevu 入口继续可用。
