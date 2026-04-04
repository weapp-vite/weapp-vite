---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 路径填充规则能力，支持 `fill(rule)` 与 `clip(rule)` 透传 `evenodd` 等填充规则参数，并同步覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的路径填充行为。
