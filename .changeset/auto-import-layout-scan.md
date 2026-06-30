---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化自动导入 Vue 类型支持文件的 layout 扫描路径。生成 `components.d.ts` / `wevu-layouts.d.ts` 时会在一次目录遍历中同时收集 layout 名称与 props 类型，避免重复读取 `src/layouts` 并减少不必要的 SFC / AST 解析开销。
