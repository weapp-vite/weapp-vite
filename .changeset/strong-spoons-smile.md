---
"@wevu/api": patch
---

继续提升 `weapi` 三端语义对齐：为 `getBackgroundAudioPlayerState`、`getDeviceBenchmarkInfo`、`getDeviceVoIPList`、`getHCEState`、`getInferenceEnvInfo`、`getNFCAdapter`、`getPerformance`、`getRandomValues`、`getRealtimeLogManager`、`getRendererUserAgent`、`getScreenRecordingState`、`getSecureElementPasses`、`getSelectedTextRange`、`getShowSplashAdStatus`、`getSkylineInfo`、`getUserCryptoManager`、`getWeRunData`、`getXrFrameSystem`、`isBluetoothDevicePaired`、`isVKSupport` 增加显式映射与 synthetic no-op shim；同步补充单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步减少支付宝与抖音 fallback 缺口。
