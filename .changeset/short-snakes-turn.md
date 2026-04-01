---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `injectRequestGlobals` 在 Vue 页面入口上的缺口：当页面在 `entriesMap` 建立前先进入编译链路时，`weapp-vite` 现在会基于已加载入口补齐请求全局对象注入，并为 Vue SFC 入口生成可编译的本地绑定代码。同时避免在产物后处理阶段对已带本地绑定的 chunk 重复注入，保证 `axios`、`graphql-request`、`fetch` 与 `@tanstack/vue-query` 在小程序运行时的请求兼容链路稳定生效。
