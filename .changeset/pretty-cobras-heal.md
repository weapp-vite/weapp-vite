---
'@wevu/api': patch
---

增强支付宝 `showModal` 映射的严格等价约束：当传入 `showCancel=false`、`editable=true` 或 `placeholderText` 等微信独有能力时，改为直接按不支持报错，避免误降级到不等价行为。同时补齐映射异常在 Promise 与 callback 两种调用方式下的单元测试，确保错误返回一致。
