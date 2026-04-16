---
'@weapp-core/shared': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

继续收敛多平台全局对象解析模型：将 `weapp-vite` 内部原本独立维护的小程序全局对象表与路由全局优先级改为直接消费 `@weapp-core/shared` 的平台 descriptor，并在 shared 层补充通用解析优先级与路由解析优先级 helper。这样后续新增 `swan`、`jd`、`xhs` 之外的平台时，`weapp-vite` 不再需要继续维护平行的全局对象映射表，优先通过共享 descriptor 自动参与解析。
