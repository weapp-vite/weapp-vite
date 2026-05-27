---
"rolldown-require": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复自动路由内联执行 `app.json.ts` 时会在源目录旁生成 `.auto-routes-inline` 临时文件的问题，改为通过 `rolldown-require` 的入口源码覆盖能力执行内联内容，并保留原始文件路径的相对导入、`__filename` 和 `__dirname` 语义。
