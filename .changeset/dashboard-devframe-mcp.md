---
"@weapp-vite/dashboard": patch
"weapp-vite": minor
"create-weapp-vite": patch
---

为 Dashboard 的状态、分页报告与受限文件读取增加 DevFrame MCP 能力，与页面共享同一组只读 RPC 和报告 revision。独立 Dashboard 自动开放同端口的本机只读 MCP，无需配置令牌，校验真实 loopback 连接对端与规范 loopback Origin，并随宿主监听、重启和关闭维护实例发现记录；浏览器 OTP、现有 MCP、REST 与微信 IDE 自动化入口保持不变。

补充面向诊断任务的摘要与预算、包／产物／模块检索、跨包重复分析、前后构建差异及事件筛选，并支持受限文件片段读取。页面、MCP 与 Markdown 报告共享浏览器安全的分析计算；列表保持快照一致性，明确缺失基线、独立分包隔离、体积估算和事件窗口丢弃语义。

同步主线 DevFrame 1.2 与预算契约：复用构建侧的文件去重、运行时上界、分包覆盖和缺失测量判定；摘要明确运行时预算及未知状态。预算沙盘与告警定位沿用同一计算入口，保留运行时／分包零限额配置与跨包贡献文件，不以提高限额掩盖未知测量。
