---
"@weapp-vite/dashboard": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 dashboard analyze 页的体积定位能力：Top Files 支持点选后查看文件内模块明细与复用收益，预算面板展示配置来源和阈值，并为 dashboard-ui-lab 增加低预算失败校验脚本以覆盖真实 `wv analyze --budget-check` 链路。
