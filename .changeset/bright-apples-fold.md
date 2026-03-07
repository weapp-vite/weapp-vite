---
"@wevu/api": minor
---

修正跨端 API 的 fallback 策略：移除将不等价事件 API 近似映射到 `onAppShow/offAppShow` 的行为，并默认关闭通用 fallback。

当目标平台缺少对应 API 且不存在功能等价显式映射时，`weapi` 现在会按 `unsupported` 处理并在调用时返回标准 not supported 错误，避免“可调用但语义错误”的假对齐。
