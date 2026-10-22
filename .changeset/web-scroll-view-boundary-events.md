---
"@weapp-vite/web": patch
---

fix(web): scroll-view 补齐 scrolltolower / scrolltoupper 边界事件。

此前 scroll-view 只派发 `scroll`，`bindscrolltolower` / `bindscrolltoupper` 永远不会触发，依赖触底事件做分页的页面在 Web 端加载不到第二页。

- 滚动到底部 / 右边派发 `scrolltolower`（`detail.direction` 为 `bottom` / `right`），滚动到顶部 / 左边派发 `scrolltoupper`（`direction` 为 `top` / `left`）
- 按 `lower-threshold` / `upper-threshold`（默认 50px，支持 px / rpx）判定触发距离
- 只在进入阈值区间时派发一次，滚离后再次进入会重新派发，内容不足以滚动时不派发
