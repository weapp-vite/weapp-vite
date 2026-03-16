---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 npm 依赖构建在 `exports.import`、`module` 与 `main` 并存时错误回退到 CommonJS 入口的问题。现在会优先选择 ESM 入口，避免把已经转译成 `_defineProperty` helper 的 CJS 产物错误带入小程序构建结果。
