---
'@wevu/compiler': patch
---

修复 Vue 模板内联表达式跨过普通函数、对象方法和类边界改写动态 `this` 的问题，保留 `map` 的 `thisArg` 以及 `call`、`apply`、`bind` 的原生语义。
