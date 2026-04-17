---
'@weapp-core/shared': patch
'@weapp-vite/ast': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

继续收敛多小程序平台与运行时安全入口：为 `@weapp-core/shared` 新增独立的 Node 专用子入口 `@weapp-core/shared/node`，将依赖 `TextEncoder` 的 `objectHash` 从运行时根入口中拆出，避免小程序环境误引入 shared 根入口时在模块初始化阶段触发宿主不兼容。同时补齐 shared 平台 descriptor 中的模板指令前缀 helper，并让 `@weapp-vite/ast`、`@wevu/compiler`、`wevu` 与 `weapp-vite` 统一消费这套 contract，补上 `a:for`、`tt:for`、`s-for` 等多平台结构指令识别与分享菜单调用回退逻辑，减少继续散落的微信默认假设。
