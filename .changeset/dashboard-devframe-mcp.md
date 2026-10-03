---
"@weapp-vite/dashboard": patch
"weapp-vite": minor
"create-weapp-vite": patch
---

为 Dashboard 的状态、分页报告与受限文件读取增加 DevFrame MCP 能力，与页面共享同一组只读 RPC 和报告 revision。独立 Dashboard 自动开放同端口的本机只读 MCP，无需配置令牌，校验真实 loopback 连接对端与规范 loopback Origin，并随宿主监听、重启和关闭维护实例发现记录；浏览器 OTP、现有 MCP、REST 与微信 IDE 自动化入口保持不变。

补充面向诊断任务的摘要与预算、包／产物／模块检索、跨包重复分析、前后构建差异及事件筛选，并支持受限文件片段读取。页面、MCP 与 Markdown 报告共享浏览器安全的分析计算；列表保持快照一致性，明确缺失基线、独立分包隔离、体积估算和事件窗口丢弃语义。
