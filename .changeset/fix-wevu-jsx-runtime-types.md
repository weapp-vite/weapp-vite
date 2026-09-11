---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复受管 `.weapp-vite/tsconfig.app.json` 把 `wevu/weapp/jsx-runtime` 写入 `compilerOptions.types` 导致 TS2688 的问题。JSX 类型改由 `jsxImportSource` 解析。
