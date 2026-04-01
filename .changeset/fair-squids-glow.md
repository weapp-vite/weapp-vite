---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复小程序产物对 `fetch`、`graphql-request`、`axios` 等请求库的编译期 request globals 注入，在公共 chunk 与页面 chunk 中同时补齐 `fetch`、`AbortController`、`XMLHttpRequest` 及相关 Web 构造器绑定，避免微信开发者工具中因缺失全局对象导致请求永久 pending 或运行时报错。
