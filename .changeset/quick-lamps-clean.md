---
"@wevu/api": patch
---

继续提升 `weapi` 三端语义对齐：为 `createBLEPeripheralServer`、`createBufferURL`、`createCacheManager`、`createGlobalPayment`、`createInferenceSession`、`createMediaAudioPlayer`、`createMediaContainer`、`createMediaRecorder`、`createTCPSocket`、`createUDPSocket`、`createVideoDecoder`、`loadBuiltInFontFace`、`notifyGroupMembers`、`requestIdleCallback`、`revokeBufferURL`、`rewriteRoute`、`seekBackgroundAudio`、`setEnableDebug`、`setInnerAudioOption` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
