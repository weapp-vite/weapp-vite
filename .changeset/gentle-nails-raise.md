---
'@wevu/api': patch
---

新增 SOTER 查询能力在支付宝端的严格等价映射：`checkIsSoterEnrolledInDevice` 映射到 `my.checkIsIfaaEnrolledInDevice`，`checkIsSupportSoterAuthentication` 映射到 `my.checkIsSupportIfaaAuthentication`。同时对 `speech` 模式补充运行时保护（按不支持报错），并补齐单元测试与兼容报告。
