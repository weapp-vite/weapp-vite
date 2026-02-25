---
"wevu": patch
"create-weapp-vite": patch
---

为 `defineModel` 增加 Vue 3 兼容的 tuple + modifiers 类型与运行时能力：支持 `const [model, modifiers] = defineModel()` 与修饰符泛型推导；同时扩展 `useModel` 的 get/set 选项以适配基于 modifiers 的值转换。补充 `tsd` 类型测试、运行时测试与 `weapp-vite` 的脚本编译测试，并同步更新 `wevu-vue-demo` 的 script-setup 兼容示例与矩阵结论。
