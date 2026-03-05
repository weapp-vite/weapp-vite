---
"wevu": patch
"create-weapp-vite": patch
---

新增 `useIntersectionObserver()` 组合式 API：在 `setup()` 内可直接创建 `IntersectionObserver`，并在 `onUnload/onDetached` 时自动断开连接，降低手写清理逻辑与滚动轮询成本。同时增强 `setData.highFrequencyWarning`：在检测到 `onPageScroll` 回调中调用 `setData` 时输出专项告警（可配置冷却时间与开关），引导改用可见性观察或节流方案，并补充对应文档与类型定义。
