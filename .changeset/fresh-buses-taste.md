---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 页面中 `onPageScroll()` 只注册到组件选项、未同步桥接到页面实例的问题。现在页面实例会暴露可调用的 `page.onPageScroll`，因此真实滚动分发路径与依赖页面实例 hook 的业务 fallback 都能收到滚动事件。
