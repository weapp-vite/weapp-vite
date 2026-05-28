---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

微信平台普通具名插槽转发 `<slot />` 时，默认改用内部 `virtualHost` 组件作为 fallback wrapper，减少旧版 `view` wrapper 对布局的影响；同时新增 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'` 作为回退选项，显式 `slotFallbackWrapper` 配置仍保持原有行为。
