---
"wevu": patch
---

移除 `onAppShow/onAppHide/onAppError/onAppLaunch` 等 `onApp*` hooks，App 生命周期统一使用：
`onLaunch/onShow/onHide/onError/onPageNotFound/onUnhandledRejection/onThemeChange`。

同时将 `onErrorCaptured` 的映射调整为 `onError`。
