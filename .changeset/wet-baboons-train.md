---
"@wevu/api": patch
---

继续收紧 `weapi` 严格兼容策略：移除支付宝/抖音对 `createBLEPeripheralServer`、`createBufferURL`、`createCacheManager`、`createGlobalPayment`、`createInferenceSession`、`createMediaAudioPlayer`、`createMediaContainer`、`createMediaRecorder`、`createTCPSocket`、`createUDPSocket`、`createVideoDecoder` 的 synthetic no-op 支持。对应平台缺失时统一按 unsupported 报错，并同步更新单元测试、类型文档与 API 兼容报告。
