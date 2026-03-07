---
"@wevu/api": patch
---

继续收紧 `weapi` 的严格兼容策略：移除支付宝/抖音对 `openCustomerServiceChat`、`compressVideo`、`openVideoEditor`、`getShareInfo`、`joinVoIPChat`，以及抖音 `openDocument` 的 synthetic 成功 shim。上述 API 在对应平台缺失时统一返回 unsupported 错误，仅保留功能完全一致的映射；并同步更新单元测试、类型文档与兼容性报告。
