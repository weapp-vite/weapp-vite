---
"@wevu/compiler": patch
"create-weapp-vite": patch
"weapp-vite": patch
"wevu": patch
---

修复组件模板中 `v-model:xxx` 会被错误转换为默认 `modelValue` 绑定的问题，现在会按 Vue 语义生成对应的 prop 与 `update:xxx` 事件绑定。
