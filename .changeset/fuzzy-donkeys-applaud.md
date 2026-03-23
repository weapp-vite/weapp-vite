---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Layout 通信演示页的页面级按钮点击无响应问题。此前事件绑定在包裹 `t-button` 的外层 `view` 上，导致点击时没有稳定触发页面方法；现在改为直接绑定到 `t-button`，使页面触发 Toast、Alert、Confirm 与子组件示例保持一致。
