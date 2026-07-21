---
"@weapp-core/constants": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

使用 Vite/Rolldown 真实模块图追踪静态与动态 import、别名、npm、外部链接源码以及小程序 template、style、JSON、WXS、layout 和 `usingComponents` sidecar 依赖，修复增量构建中 importer 传播不完整、无关入口被重复标脏及 sidecar 新增删除失效不稳定的问题。
