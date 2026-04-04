---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 补齐 `wx.showShareMenu`、`wx.updateShareMenu`、`wx.hideShareMenu` 的 demo 与端到端验证链路。新增 component-lab fixture、headless 集成断言和 browser e2e 断言，确保 web 模拟器里的分享菜单状态快照可以被稳定触发、观察与回归验证。
