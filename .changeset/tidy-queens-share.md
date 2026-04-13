---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 的组件模板 ref 类型链路，补齐对 Vue 3.5 `DefineComponent` 额外泛型的透传，并让 `defineComponent()` 返回的组件定义继续对齐 `DefineComponent` 公共实例类型。现在通过 `ref()` 或 `useTemplateRef()` 引用带 `defineExpose()` 的组件时，暴露成员、`$refs` 与 `$el` 等类型信息都能被正确推导，不再出现“功能正常但类型报错”的问题。
