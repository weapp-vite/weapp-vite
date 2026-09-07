---
"@mpcore/simulator": patch
---

补齐组件实例的关系节点查询与作用域选择器查询，支持双向组件关系的建立和解除，并让 Node 与浏览器容器中的嵌套原生组件复用同一套关系状态。修复 TDesign 等组件调用 `getRelationNodes` 和 `createSelectorQuery` 时出现的方法缺失错误。
