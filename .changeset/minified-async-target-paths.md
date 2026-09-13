---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复压缩产物中反引号形式的 `require.async` 分包目标标记未被重写的问题，确保 SQLite 等异步分包按最终 chunk 位置生成正确的相对加载路径。
