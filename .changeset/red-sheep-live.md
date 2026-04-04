---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 绘制状态能力，新增 `clip`、`setGlobalAlpha`、`setLineDash`，并把最终透明度与虚线状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的绘制流程。
