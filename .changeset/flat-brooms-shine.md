---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `npm.strategy = 'explicit'` 模式下普通依赖仍被错误 external 到小程序运行时的问题，让 `dayjs` 这类普通 npm 包默认继续交给 Vite 内联打包。同时补齐共享 chunk 复制后的跨分包依赖本地化，避免复制产物继续引用其他分包 `common.js`，并去掉 wevu 路由示例中的重复路由注册 warning。
