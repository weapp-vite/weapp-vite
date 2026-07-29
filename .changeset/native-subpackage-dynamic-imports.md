---
"weapp-vite": minor
"create-weapp-vite": patch
"@mpcore/simulator": patch
"@weapp-vite/ast": patch
---

新增微信普通分包原生动态导入模式，将符合条件的静态 `import()` 转换为 `require.async()`，同时修复异步 require 源码扩展名未改写的问题，并补齐模拟器兼容支持。
