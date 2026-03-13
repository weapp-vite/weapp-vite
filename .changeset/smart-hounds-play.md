---
'weapp-vite': patch
'create-weapp-vite': patch
---

扩展 `weapp.autoRoutes` 配置，除了继续支持 `boolean` 快速开关外，也支持传入对象进行细粒度控制，可分别配置 `enabled`、`typedRouter`、`persistentCache` 和 `watch`，以便按项目需要调整自动路由的类型输出、持久缓存与开发期监听行为。
