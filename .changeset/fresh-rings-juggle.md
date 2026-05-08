---
"@wevu/compiler": patch
---

修复组件节点直接使用 `v-for` 时，隐式默认插槽的 `vue-slots` 元数据没有注入的问题。
