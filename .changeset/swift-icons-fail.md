---
"wevu": patch
"create-weapp-vite": patch
---

进一步对齐 `wevu/router` 与 Vue Router 的导航 Promise 心智：默认情况下，守卫抛错等“异常型失败”会以 Promise reject 抛出；常规导航失败（如 duplicated/cancelled）仍通过返回值传递。新增 `UseRouterOptions.rejectOnError` 可关闭该行为，回退到始终返回失败对象的模式。
