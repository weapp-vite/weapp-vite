---
'@wevu/compiler': patch
'create-weapp-vite': patch
---

修复 `@wevu/compiler` 在 `defineOptions` 与组件事件内联表达式组合场景下的注入缺陷：当组件选项通过 spread 合并且 `methods` 来自 spread 对象时，内联事件映射会新增同名 `methods` 键导致原方法被覆盖，进而在模板中触发 `@change="onChange"` 时出现 `onChange is not a function`。本次调整为按 spread 来源合并 `methods` 后再注入 `__weapp_vite_inline_map`，并恢复零售模板 tabbar 使用标准 Vue 事件写法，避免运行时方法丢失。
