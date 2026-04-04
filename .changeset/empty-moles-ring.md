---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 路径能力，新增 `quadraticCurveTo`、`bezierCurveTo`、`arcTo`，并同步覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的曲线路径调用流程。
