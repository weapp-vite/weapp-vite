---
"weapp-ide-cli": patch
---

修复微信开发者工具长截图在部分版本中触发 `__inspectee__ is not defined` 时直接失败的问题。现在长截图读取滚动指标遇到该兼容错误时会降级为当前视口截图，保证 `wv screenshot --full-page` 和 dev 快捷键截图仍能输出图片。
