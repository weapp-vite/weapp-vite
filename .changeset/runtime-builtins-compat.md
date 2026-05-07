---
"wevu": patch
"@wevu/api": patch
"@wevu/compiler": patch
"@wevu/web-apis": patch
"@weapp-vite/web": patch
"@weapp-vite/ast": patch
"weapp-vite": patch
---

将会进入小程序运行时、编译链路和回归示例的 `Object.hasOwn()` 调用改为兼容的 `Object.prototype.hasOwnProperty.call(...)` 封装，并补充 ESLint 限制，避免 Rolldown 无法降级的运行时内建 API 进入小程序产物。
