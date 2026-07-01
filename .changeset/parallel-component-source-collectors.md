---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

并发执行 Vue SFC 编译阶段的 script setup 组件导入收集与模板自动导入组件收集，保持固定合并顺序的同时减少组件来源分析的等待时间。
