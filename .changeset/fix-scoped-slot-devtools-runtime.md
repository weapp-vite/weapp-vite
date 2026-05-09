---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复增强 scoped slot 在微信开发者工具真实运行时下的属性同步问题，避免生成非法 WXML 表达式、非法 data path descriptor、属性覆盖以及向顶层 data 写入 undefined 的 warning。scoped slot 运行时现在会从宿主组件同步安全的小写 slot owner / props 数据，并保留 IDE e2e 覆盖。
