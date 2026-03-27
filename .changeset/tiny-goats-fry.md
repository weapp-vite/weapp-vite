---
"@mpcore/simulator": patch
---

为 `@mpcore/simulator` 增加 `wx.showModal` 宿主能力，支持默认确认返回、按次 mock 弹窗结果，并暴露 modal 调用日志用于 runtime/browser 断言。
