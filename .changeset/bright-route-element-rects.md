---
'@weapp-vite/miniprogram-automator': patch
---

修复部分微信开发者工具版本中 `Element.offset()` 只返回坐标、缺少宽高的问题；当协议响应不完整时，会通过 DOM 尺寸属性补齐结果。
