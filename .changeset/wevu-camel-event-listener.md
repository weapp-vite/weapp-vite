---
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复 Wevu 组件 camelCase props 和事件未统一映射到小程序 kebab-case 宿主名称的问题，确保 `quantityChange` 能匹配 `@quantity-change`，同时保留 `update:modelValue` 等带冒号事件的既有命名语义。
