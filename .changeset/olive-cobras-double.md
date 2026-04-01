---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` 增加请求相关全局对象自动注入能力：当项目检测到 `axios`、`graphql-request` 等依赖时，会在小程序入口按需补齐 `fetch`、`Headers`、`Request`、`Response`、`AbortController`、`AbortSignal` 与 `XMLHttpRequest`，同时支持通过 `weapp.injectRequestGlobals` 显式开启、关闭或裁剪注入目标。
