---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.createVideoContext` 的基础能力，在 headless/runtime/browser 三层统一支持按页面或组件作用域定位 `video` 节点，并补齐 `play`、`pause`、`seek`、`stop`、`requestFullScreen`、`exitFullScreen` 等常用上下文方法及对应事件派发。这样在 Web 模拟环境里，依赖视频上下文控制播放与全屏状态的小程序页面可以获得更接近微信小程序的行为。
