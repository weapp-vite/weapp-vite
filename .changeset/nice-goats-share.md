---
'@wevu/api': patch
---

新增 `getSystemInfoAsync(wx)` 在抖音端的严格等价映射：转调 `tt.getSystemInfo`，统一按微信命名暴露异步系统信息查询能力。支付宝端仍保持 unsupported。同步补充单元测试、类型注释与兼容矩阵报告。
