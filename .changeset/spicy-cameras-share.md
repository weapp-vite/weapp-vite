---
"create-weapp-vite": patch
"weapp-vite": patch
---

调整 `weapp-vite-lib-template` 的默认发布配置，使组件库模板更适合发布到 npm 并由宿主自行安装 `wevu`。现在模板会将 `wevu` 声明为 `peerDependencies`，同时在 lib 模式构建里将 `wevu` 及其子路径（如 `wevu/router`、`wevu/api`）统一 external，避免运行时包被打进组件库产物。
