---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.createVideoContext` 的基础能力，在 headless/runtime/browser 三层统一支持按页面或组件作用域定位 `video` 节点，并补齐 `play`、`pause`、`seek`、`stop`、`requestFullScreen`、`exitFullScreen` 等常用上下文方法及对应事件派发。同时修复组件实例选择器把后代组件误判为当前选择结果的问题，确保 `selectComponent` / `selectAllComponents` 在单段选择器与后代选择器场景下都更接近微信小程序行为。
