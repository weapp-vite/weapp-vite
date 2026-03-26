---
'@mpcore/simulator': patch
---

增强 `@mpcore/simulator` 的宿主能力与浏览器控制台体验：补齐 `triggerEvent` 在组件宿主链上的冒泡/截断行为，新增 `showToast`、`setStorageSync/getStorageSync` 与基于内存路由表的 `wx.request` mock 通道，并让 web demo 的代码面板统一使用 Shiki 高亮展示。
