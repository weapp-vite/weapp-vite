---
"@wevu/api": patch
---

继续收紧 `@wevu/api` 的严格兼容策略：移除 `canvasGetImageData`、`canvasPutImageData` 以及 `checkDeviceSupportHevc` 等 7 个 `check*` API 在支付宝/抖音端的 synthetic shim 与运行时兜底实现。对于无同等能力的场景，统一改为 unsupported 报错，并同步更新支持矩阵文案、单元测试断言与 API 兼容报告产物。
