---
"@wevu/api": patch
---

继续收紧 `@wevu/api` 的三端兼容策略：移除 `addPhoneContact`、`openOfficialAccountArticle`、`openOfficialAccountChat`、`openOfficialAccountProfile`、`openPrivacyContract` 在支付宝/抖音端的 synthetic no-op 支持（其中 `addPhoneContact` 保留支付宝直连能力）。当宿主端缺少同等能力时，统一按 unsupported 报错，并同步更新单测、支持矩阵与 API 兼容报告。
