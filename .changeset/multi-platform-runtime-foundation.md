---
'@weapp-core/shared': patch
'@weapp-vite/web': patch
'@wevu/api': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-ide-cli': patch
'weapp-vite': patch
'wevu': patch
---

继续收敛多小程序平台的 runtime 基础模型：在 `@weapp-core/shared` 中统一平台 registry、宿主 config key、全局对象与路由解析优先级、默认 `build.target`、App 样式与 App 级监听 capability，并将页面栈、SelectorQuery、IntersectionObserver、分享菜单、滚动/下拉刷新等宿主能力描述统一到共享 descriptor。同时将 shared 根入口整理为运行时安全入口，避免静态依赖 Node 内置模块；`weapp-vite`、`wevu`、`@wevu/api`、`@wevu/compiler`、`@weapp-vite/web` 与 `weapp-ide-cli` 改为消费这套共享 contract，从而减少新增平台时在核心包内重复散落平台分支的成本。
