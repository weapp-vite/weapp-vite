---
'@wevu/web-apis': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` / `@wevu/web-apis` 的 Web Runtime 按需注入链路补齐下一批高频全局能力：新增 `atob`、`btoa`、`queueMicrotask`、`performance.now`、`crypto.getRandomValues`、`Event`、`CustomEvent` 的 runtime installer、局部绑定和自动目标解析，并补充 `github-issues` 中 issue #448 的构建回归页，确保这些能力在真实小程序构建产物里可以按需注入到页面作用域。
