---
"@wevu/api": patch
---

继续提升 `weapi` 三端语义对齐：补充 `addCard`、`addFileToFavorites`、`addPaymentPassFinish`、`addPaymentPassGetCertificateData`、`addPhoneCalendar`、`addPhoneContact`、`addPhoneRepeatCalendar`、`addVideoToFavorites`、`authorizeForMiniProgram`、`authPrivateMessage`、`bindEmployeeRelation`、`canAddSecureElementPass` 的显式映射与 synthetic no-op shim，并同步更新单元测试、类型文档与兼容性报告，进一步降低 fallback 数量。
