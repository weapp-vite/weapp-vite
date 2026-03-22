---
'wevu': patch
'create-weapp-vite': patch
---

为 `wevu` 增加 `useLayoutHosts()`、`resolveLayoutHost()` 与 `waitForLayoutHost()`，将 layout 共享宿主的注册、解析与就绪等待能力下沉到运行时，减少模板侧重复编写 bridge key、重试与 `selectComponent` 适配逻辑。同步简化两个 TDesign wevu 模板中的 toast/dialog hooks 与 layout 注册写法，使页面和组件调用 layout 内反馈能力时更直接、更容易维护。
