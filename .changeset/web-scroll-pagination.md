---
"@weapp-vite/web": patch
---

fix(web): 修复滚动分页，并完善 scroll-view 定位和边界事件。

页面滚动进入距底部 50px 的区间时，在 `onPageScroll` 后调用一次 `onReachBottom`。内容不足一屏、页面切换时恢复滚动位置，以及滚动回调内发生导航时不会误触发；`page.json.onReachBottomDistance` 自定义距离尚未支持。

`scroll-view` 支持 `scrolltolower` / `scrolltoupper`，`detail.direction` 对应 `bottom` / `right` / `top` / `left`。`lower-threshold` / `upper-threshold` 默认 50px，支持 px / rpx；内容不可滚动时不派发。

边界事件仅在进入阈值区间时派发，离开后可再次触发；追加内容或尺寸变化后也能继续分页，横纵轴分别判断。

支持 `scroll-into-view` 目标定位、`scroll-into-view-alignment` 对齐（默认 `start`，另支持 `center` / `end` / `nearest`）和 `scroll-into-view-offset` 偏移（默认 0）；修复动态目标、`enable-flex` 子项布局及默认滚动条行为。

`scrollstart` / `scrollend` 使用浏览器滚动事件与 150ms 静默窗口模拟；`refresher` 下拉刷新仍未实现。
