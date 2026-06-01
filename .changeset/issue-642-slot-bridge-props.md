---
"wevu": patch
"create-weapp-vite": patch
---

修复 performance 预设下组件 slot 桥接字段没有同步到顶层 data 的问题，避免普通插槽误渲染 fallback、scoped slot 拿不到 owner id。同步发布 create-weapp-vite，保持脚手架模板依赖版本与本次修复一致。
