---
"@wevu/api": patch
---

补充支付宝 BLE 连接状态事件的严格等价映射：

- `onBLEConnectionStateChange` 对齐到 `my.onBLEConnectionStateChanged`
- `offBLEConnectionStateChange` 对齐到 `my.offBLEConnectionStateChanged`

该调整只处理名称差异导致的不一致，不引入任何近似 fallback。抖音端保持 `unsupported`，避免错误语义对齐。
