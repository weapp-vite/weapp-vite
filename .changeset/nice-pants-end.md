---
"wevu": patch
"create-weapp-vite": patch
---

对 `wevu` 的 `ref` 类型声明进行兼容增强，新增无参重载以对齐 Vue 3 的使用习惯，并补充对应的类型测试覆盖。同步更新 `wevu-vue-demo` 示例，统一模板为 Vue 语法（`v-for` / `v-if` / `@tap` 等），修复 demo 中现存的 `vue-tsc` 与 eslint 问题，并将 Volar 模板类型库显式切换到 `wevu`，使小程序内置标签类型跳转指向 `wevu` 的 intrinsic elements 声明。
