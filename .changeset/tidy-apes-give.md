---
"@mpcore/simulator": patch
---

为 `@mpcore/simulator` 增加 `wx.showActionSheet` 宿主能力，支持默认选中第一项、按次 mock 取消或指定选项，并暴露 action sheet 调用日志用于 runtime/browser 断言。
