---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 开发态局部 HMR 在原子保存或 create 事件下补发全量 fallback 页面资产的问题，并让 workspace HMR 审计在启动产物稳定后再进入正式测量，减少首次构建产物补齐对影响面报告的干扰。
