---
"wevu": patch
"create-weapp-vite": patch
---

新增原生组件 `properties` 类型推导工具：`InferNativePropType`、`InferNativeProps`、`NativePropType`、`NativeTypeHint`、`NativeTypedProperty`，并在 `wevu-vue-demo` 与文档中补充 `script setup` 直接导入原生组件的推荐写法。现在可基于 `properties` 作为单一数据源生成 props 类型，并通过 `NativePropType<T>`（类似 Vue `PropType<T>`）为联合字面量提供更简洁的类型提示，减少手写接口与重复断言。
