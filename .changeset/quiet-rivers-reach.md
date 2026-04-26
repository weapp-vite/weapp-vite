---
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu 组件式页面中 `onReachBottom` 未同步暴露到页面 `methods` 的问题，确保微信运行时按页面方法分发触底事件时也能触发通过组合式 API 注册的回调。
