---
"wevu": patch
"create-weapp-vite": patch
---

修复 scoped slot 兼容组件未启用 `virtualHost` 导致插槽内容在 flex 父级中被额外组件节点包裹、布局无法横向排列的问题。
