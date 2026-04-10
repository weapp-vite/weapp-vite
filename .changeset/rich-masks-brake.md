---
"weapp-vite-wevu-tailwindcss-tdesign-retail-template": patch
"create-weapp-vite": patch
---

修复 retail tabs 场景下 `t-tab-panel` 的 `label` 可能传入空值导致宿主运行时 warning 的问题，为标签文案补齐空字符串兜底，减少模板与示例应用在微信开发者工具中的无意义告警。
