---
'create-weapp-vite': patch
---

统一调整 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 的 wevu 组件默认样式隔离配置为 `apply-shared`，使组件能够继承 `src/app.vue` 中的全局样式（如 Tailwind 基础样式与全局工具类），减少组件样式隔离导致的全局样式失效问题。
