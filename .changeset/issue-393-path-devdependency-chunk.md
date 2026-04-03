---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `chunks.sharedMode: 'path'` 命中 npm devDependency 共享模块时会把 chunk 输出到 `dist/node_modules/**` 的问题。现在 path 模式会把 `node_modules` 依赖改写为包相对路径（例如 `debounce/index.js`），同时补充 `github-issues` 的 issue #393 复现页与构建回归测试。
