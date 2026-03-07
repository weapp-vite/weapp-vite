---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加 `router.currentRoute` 只读引用，直接暴露当前路由状态并与 `onShow/onRouteDone` 等页面路由生命周期保持同步，进一步贴近 Vue Router 的使用心智；同步补充运行时与类型测试。
