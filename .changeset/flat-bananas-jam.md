---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.createVideoContext` 与 `createIntersectionObserver` 的基础能力，在 headless/runtime/browser 三层统一支持按页面或组件作用域定位目标节点，并补齐常见上下文方法、初始可见性计算与事件/回调派发。同时修复组件实例选择器把后代组件误判为当前选择结果的问题，确保 `selectComponent` / `selectAllComponents` 在单段选择器与后代选择器场景下都更接近微信小程序行为。
