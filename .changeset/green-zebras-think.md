---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 新增 `go(delta)` 与 `forward()` 导航方法：`go(<0)` 复用小程序 `navigateBack` 回退，`go(0)` 为无操作，`forward()` 在小程序路由能力受限场景下返回 `NavigationFailureType.aborted`。同时补充对应的运行时与类型测试，完善与 Vue Router 导航 API 的对齐体验。
