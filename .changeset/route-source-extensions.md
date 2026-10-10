---
'create-weapp-vite': patch
'weapp-vite': minor
---

feat(routes): 新增 autoRoutes.extensions 页面入口过滤，统一路由声明、主包和独立分包的源码选择。

- 新增 `autoRoutes.extensions` 页面入口过滤，使路由声明、主包和独立分包使用同一组选中源码，保留配套资源与显式业务导入；路由增删按已生成入口版本清除加载器缓存，避免漏更新。
