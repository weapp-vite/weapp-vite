---
'weapp-vite': minor
'create-weapp-vite': minor
---

为 `weapp.appPrelude` 新增 `mode: 'require'` 模式，按主包/分包作用域输出 `app.prelude.js` 并在对应 chunk 顶部注入静态 `require(...)`，以在保留前置执行时机的同时减少重复内联代码。
