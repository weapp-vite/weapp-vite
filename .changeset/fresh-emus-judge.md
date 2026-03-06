---
"@wevu/api": patch
---

为 `@wevu/api` 新增运行时能力探测 API：`resolveTarget(method)` 可返回当前平台下的目标方法映射与可调用状态，`supports(method)` 可快速判断微信命名 API 在当前适配器上是否可用。同时在 CI 中补充 `weapi` 专项守卫任务，强制校验 catalog/docs/report 生成结果与单元/类型测试，避免类型源升级后兼容矩阵与报告失真。
