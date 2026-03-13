---
'weapp-vite': patch
'create-weapp-vite': patch
---

扩展 `weapp.autoRoutes.persistentCache` 配置，除了 `boolean` 之外也支持传入字符串来自定义自动路由缓存文件位置，并保持默认关闭持久化缓存。
