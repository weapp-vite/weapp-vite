---
"@wevu/api": patch
---

继续提升 `weapi` 三端语义对齐：为 `canvasGetImageData`、`canvasPutImageData` 与 `checkDeviceSupportHevc`、`checkEmployeeRelation`、`checkIsAddedToMyMiniProgram`、`checkIsOpenAccessibility`、`checkIsPictureInPictureActive`、`checkIsSoterEnrolledInDevice`、`checkIsSupportSoterAuthentication` 增加显式映射与 synthetic shim；同步补充单元测试与 tsd 类型断言，并更新支持矩阵文档与 API 兼容性报告，进一步减少支付宝/抖音 fallback 缺口。
