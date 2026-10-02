---
"weapp-vite": minor
"create-weapp-vite": patch
---

为 Dashboard 的状态、分页报告与受限文件读取增加 DevFrame MCP 能力，与页面共享同一组只读 RPC 和报告 revision。独立 Dashboard 自动开放同端口的本机只读 MCP，无需配置令牌，校验真实 loopback 连接对端与规范 loopback Origin，并随宿主监听、重启和关闭维护实例发现记录；浏览器 OTP、现有 MCP、REST 与微信 IDE 自动化入口保持不变。
