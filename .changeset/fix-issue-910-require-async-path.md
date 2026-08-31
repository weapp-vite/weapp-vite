---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复代码提升后 `require.async` 分包加载路径计算错误的问题，确保异步模块从最终输出 chunk 位置正确解析。
