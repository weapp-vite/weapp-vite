---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 页面与共享 chunk 相关的 HMR 回归，恢复无显式 page hook hint 时的页面特性注入，并补回样式块预解析与构建轮次级 compileOptions 缓存隔离，避免 watch 重编译时出现组件默认导出丢失。
