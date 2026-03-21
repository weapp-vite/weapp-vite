---
'weapp-vite-wevu-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
'create-weapp-vite': patch
---

将模板中的 Vue SFC 配置从 `<json>` 自定义块统一迁移为 `definePageJson` 与 `defineComponentJson` 等宏指令写法，避免继续生成旧式配置示例。
