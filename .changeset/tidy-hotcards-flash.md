---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态新增自动导入 Vue SFC 组件时，组件入口可能已被标记为 loaded 导致模板产物没有重新生成的问题。
同步发布 create-weapp-vite，保持脚手架模板依赖的 weapp-vite 版本与本次修复一致。
