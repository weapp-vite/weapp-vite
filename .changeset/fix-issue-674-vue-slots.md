---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复无业务 props 的 Vue SFC 组件在 `setup` 中调用 `useSlots()` 或 `defineSlots()` 时无法读取父级传入插槽的问题。编译收尾阶段现在会在脚本使用 slot 元数据时为组件同步注入 `vueSlots` 等内部属性，确保默认插槽和具名插槽的存在性检测可用。
