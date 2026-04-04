---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 线条样式能力，新增 `setLineCap`、`setLineJoin`、`setMiterLimit`，并把最终样式状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 和 Web demo 里验证更接近微信小程序的描边行为。
