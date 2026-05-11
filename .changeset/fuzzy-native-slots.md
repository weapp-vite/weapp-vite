---
"@wevu/compiler": patch
---

修复增强 scoped slot 递归编译时，原生小程序组件的普通默认插槽被继续拆成嵌套 scoped slot 组件的问题，避免生成多余的 `index.__scoped-slot-default-*` 产物。
