---
"@wevu/api": patch
---

继续移除 `@wevu/api` 中非等价映射：`chooseMedia` 在支付宝侧不再映射到 `chooseImage`，`chooseMessageFile` 在支付宝/抖音侧不再映射到 `chooseImage`。当平台缺少同等 API 时统一返回 unsupported，并同步删除对应无效转换逻辑、更新单元测试与兼容报告。
