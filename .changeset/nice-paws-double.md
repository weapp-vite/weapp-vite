---
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 模板中数据页与组件实验室页的 TDesign `Tabs` 切换事件兼容性问题。此前页面直接读取 `event.detail.value`，在当前运行时桥接下点击“今日”“本月”等标签可能拿到 `undefined` 并报错；现在已兼容值直传、`detail` 直传与 `detail.value` 三种事件形态。
