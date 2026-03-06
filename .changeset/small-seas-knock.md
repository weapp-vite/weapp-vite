---
"wevu": patch
"create-weapp-vite": patch
---

调整 `wevu` 根入口的路由 helper 命名，移除易与 `wevu/router` 高阶导航混淆的 `useRouter()/usePageRouter()`，统一改为 `useNativeRouter()/useNativePageRouter()`；同时在注释中明确推荐优先使用 `wevu/router` 的 `useRouter()` 获取更完整的导航能力（守卫、失败分类与解析能力）。
