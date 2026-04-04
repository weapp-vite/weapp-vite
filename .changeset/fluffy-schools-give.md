---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 文本布局能力，新增 `setTextAlign` 与 `setTextBaseline`，并把最终文本对齐状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的文本绘制配置。
