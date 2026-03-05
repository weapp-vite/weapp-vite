---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增 `onMemoryWarning()` App 生命周期能力：在 `setup()` 注册后，运行时会桥接 `wx.onMemoryWarning` 并在重复绑定时自动调用 `wx.offMemoryWarning` 清理旧监听，避免内存告警监听器累积。开发者可在回调中集中回收大缓存、临时对象与冗余订阅，同时补齐对应的类型定义、单测与 website 文档。
