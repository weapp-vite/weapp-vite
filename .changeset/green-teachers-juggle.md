---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 补齐了更多 `wx.createCanvasContext` 的路径与变换能力，包括 `arc`、`rect`、`closePath`、`save`、`restore`、`translate`、`rotate`、`scale`，并同步更新了 headless runtime、browser runtime、类型声明与 browser e2e 覆盖，方便在 Web 模拟器里还原更接近微信小程序的 canvas 交互流程。
