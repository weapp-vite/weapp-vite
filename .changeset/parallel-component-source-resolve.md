---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

并发解析 Vue SFC 编译阶段的 script setup 组件导入与模板自动导入组件，减少多组件页面中 resolver 与组件静态元信息读取的串行等待时间。
