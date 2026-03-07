---
"wevu": patch
"create-weapp-vite": patch
---

进一步分层 `wevu/router` 的路由配置校验策略：初始化阶段对无效记录采用“告警并跳过”（空 `name/path`、重复/无效 `alias`、循环 `children` 引用）；运行时 `addRoute()` 对根记录采用“失败即抛错”（缺失 `name/path` 或循环引用直接抛错）。

同时补充对应回归测试与文档说明，明确初始化与动态注册两条链路的容错等级，减少迁移期配置歧义。
