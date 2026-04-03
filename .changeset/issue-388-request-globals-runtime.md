---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 request globals 在小程序运行时里遇到残缺构造器时的注入与绑定链路，确保 `axios`、`graphql-request` 等依赖 `URL`、`XMLHttpRequest` 的请求库在 WeChat DevTools 真实环境下可以正常工作，并补充对应的运行时与 IDE 回归测试。
