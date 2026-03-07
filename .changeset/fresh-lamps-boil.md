---
"@wevu/api": patch
---

进一步收紧 weapi 的非等价兼容策略：移除抖音端 `showActionSheet` 缺失时降级 `showModal` 的行为。

现在当 `tt.showActionSheet` 不可用时，会按 `unsupported` 返回标准 not supported 错误；仅在目标平台存在功能等价 API 时才进行显式映射。
