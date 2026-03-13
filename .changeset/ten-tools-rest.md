---
'wevu': major
'create-weapp-vite': patch
---

调整 `wevu/router` 的创建与获取语义：新增 `createRouter()` 作为显式创建入口，`useRouter()` 只负责获取已创建的 router 实例，不再承担创建职责。同步更新相关测试与文档说明，推荐在应用入口或上层 `setup()` 中先调用 `createRouter()`，后续业务代码再通过 `useRouter()` 读取当前实例。
