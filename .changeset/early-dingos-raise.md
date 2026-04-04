---
'@mpcore/simulator': patch
---

补强了 `@mpcore/simulator` 对 `wx.createCanvasContext().drawImage(...)` 常见参数形态的覆盖，新增对 3 参数、5 参数与 9 参数调用形态的 headless runtime、browser runtime、类型契约与 Web demo 验证，方便在 Web 模拟器里稳定回归更接近微信小程序的图片绘制调用流程。
