---
'@weapp-core/shared': patch
'@wevu/api': patch
'create-weapp-vite': patch
'wevu': patch
---

继续收敛多平台 runtime 宿主 contract：在 `@weapp-core/shared` 的平台 descriptor 中补充统一的 `hostConfigKey` 与全局路由能力描述，并让 `wevu`、`@wevu/api` 改为消费这份共享 contract 来解析宿主配置、全局路由回退与开发态判断。同时修正 `wevu createApp()` 在宿主存在全局对象但缺少 `__wxConfig` 时的重复注册保护，降低后续新增平台时继续修改核心 runtime 的概率。
