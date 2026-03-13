---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp.autoRoutes.persistentCache` 的默认值调整为关闭。显式开启 `autoRoutes: true` 或对象配置后，不再默认生成 `.weapp-vite/auto-routes.cache.json`；只有在明确设置 `persistentCache: true` 时才会写入持久化缓存文件，减少仓库和示例应用中的本地状态产物。
