---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 文本与阴影能力，新增 `strokeText` 与 `setShadow`，并把最终阴影状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的文本绘制流程。
