---
'@weapp-core/constants': patch
---

feat(constants): 新增 Web Runtime 派生目标与共享判定函数名契约

新增 `WEB_RUNTIME_DERIVED_GLOBAL_TARGETS`（`URL`、`URLSearchParams`、`Blob`、`File`、`FormData`）与 `WEB_RUNTIME_GLOBAL_INSTALL_PREDICATE`（`shouldInstallWebRuntimeGlobal`）两个共享契约：前者是依赖展开目标的唯一来源，公开配置类型与运行时集合都由它派生；后者是原生全局桥接调用的共享写入判定函数名，`weapp-vite` 生成代码与 `@wevu/web-apis` 运行时导出必须一致，并有契约用例锁定。