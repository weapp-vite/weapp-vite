---
'weapp-vite': patch
'create-weapp-vite': patch
---

统一小程序全局 API 名称与路由运行时的跨平台能力映射。`weapp-vite/auto-routes` 及其内部生成代码现在会覆盖 `swan`、`jd`、`xhs` 等运行时全局对象回退，同时把平台到全局 API 名称的映射抽到共享 helper，减少重复判断并为后续多平台扩展提供一致入口。
