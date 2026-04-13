---
'@wevu/compiler': patch
'wevu': patch
'create-weapp-vite': patch
---

修复 Vue 3.4 `v-bind` shorthand 在小程序模板编译中的兼容性问题。现在除了普通属性绑定外，`:foo-bar`、`:class`、`:style`、`:ref`、`<slot :name />` 与 `<component :is />` 等场景都会按 Vue 3.4 语义回退到同名表达式，并正确处理 kebab-case 到 camelCase 的变量映射，避免编译后丢失绑定或把动态组件错误降级为普通标签。
