---
'@weapp-core/constants': minor
'weapp-vite': patch
'create-weapp-vite': patch
---

新增 `@weapp-core/constants` 包，用于沉淀可同时被 Node 侧构建流程、小程序运行时代码以及测试复用的共享常量；同时将请求全局对象注入与 app prelude 相关的内部私有命名迁移到该包统一管理，缩短 guard key、共享字段和 helper 标识符，减少最终构建产物中的冗长内部字段名，同时保持原有运行时行为与兼容性不变。
