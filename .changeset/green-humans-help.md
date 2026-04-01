---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` request globals 在小程序多作用域运行时下的第三方请求兼容：请求相关全局对象现在会同时注入到 `App` 与页面入口，并补齐 `graphql-request` 所需的 `URL` / `URLSearchParams` 能力，同时增强 `fetch` 兼容以支持 `axios` 的 fetch adapter 在 GET/HEAD 场景下正常工作。
