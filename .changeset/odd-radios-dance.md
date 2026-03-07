---
"@wevu/api": patch
---

继续提升 `weapi` 三端语义对齐：将 `onBeforeAppRoute`、`onBeforePageLoad`、`onBeforePageUnload`、`onBLEConnectionStateChange`、`onBLEMTUChange`、`onBLEPeripheralConnectionStateChanged`、`onCopyUrl`、`onEmbeddedMiniProgramHeightChange`、`onGeneratePoster`、`onHCEMessage`、`offBLEMTUChange`、`offBLEPeripheralConnectionStateChanged`、`offCopyUrl`、`offEmbeddedMiniProgramHeightChange`、`offGeneratePoster`、`offHCEMessage`、`offKeyboardHeightChange`、`offKeyDown`、`offKeyUp`、`offLocalServiceDiscoveryStop` 从通用 fallback 升级为显式跨端映射（`onAppShow/offAppShow` 近似策略）；同步补充运行时单元测试、tsd 类型断言及支持矩阵/兼容性报告，进一步降低 fallback 缺口。
