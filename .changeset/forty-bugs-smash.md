---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 canvas 导出链路，新增 `wx.canvasToTempFilePath` 支持：会把当前 canvas snapshot 导出到 headless 临时文件并返回 `tempFilePath`，同时覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的绘制后导出流程。
