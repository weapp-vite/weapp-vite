---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 虚线状态观察能力，在 canvas snapshot 中新增 `lineDashOffset`，让 `setLineDash(pattern, offset)` 的偏移配置也能在 headless runtime、browser runtime 与 Web demo 中被稳定验证。
