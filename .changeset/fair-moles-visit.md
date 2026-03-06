---
"@wevu/api": patch
---

为 `@wevu/api` 增加兼容能力分级与严格模式：`resolveTarget` 新增 `supportLevel/semanticAligned`，`supports` 支持语义模式判断；`createWeapi` 新增 `strictCompatibility` 选项用于关闭通用 fallback。并将兼容报告升级为“双指标”视图（可调用覆盖率 + 语义对齐覆盖率），同时输出各平台 fallback 方法规模，便于在高覆盖与高语义一致性之间做可观测的取舍。
