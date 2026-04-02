---
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 表单页“加急”开关的交互体验：现在既支持直接点击 `t-switch` 切换，也支持点击整行区域切换，并补充对应的 DevTools e2e 回归测试，避免后续模板回归为“看起来无响应”的状态。
