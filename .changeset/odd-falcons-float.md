---
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

收敛 `appPrelude` 与 `requestRuntime` 的默认注入路径，并修复默认开启 `allowNullPropInput` 后无 props 页面在小程序运行时触发 `Object.entries(undefined)` 的问题。现在 `weapp.appPrelude.requestRuntime` 在 `require` 模式下会优先安装到 `app.prelude.js`，对应的 DevTools 运行时用例已覆盖；同时无 props 的页面也不会再因为空属性归一化而在启动时崩溃。
