---
"@wevu/api": patch
---

继续推进 `weapi` 严格兼容策略：移除支付宝/抖音对 `chooseInvoiceTitle`、`chooseLicensePlate`、`choosePoi`、`closeBLEConnection`、`createBLEConnection`、`cropImage`、`editImage`、`exitVoIPChat`、`faceDetect`、`getApiCategory`、`getBackgroundFetchToken`、`getChannelsLiveInfo`、`getChannelsLiveNoticeInfo`、`getChannelsShareKey`、`getChatToolInfo`、`getCommonConfig`、`getGroupEnterInfo`、`getPrivacySetting`、`initFaceDetect`、`join1v1Chat` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
