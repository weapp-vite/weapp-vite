---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的页面事件补充可观测的下拉刷新状态，使 `wx.stopPullDownRefresh()` 在 headless runtime 与 browser runtime 中都能被稳定验证。
