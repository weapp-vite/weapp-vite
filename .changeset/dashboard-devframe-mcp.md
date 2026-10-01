---
"weapp-vite": minor
"create-weapp-vite": patch
---

为 Dashboard 的状态、分页报告与受限文件读取增加 DevFrame MCP 能力，与页面共享同一组只读 RPC 和报告 revision。独立 Dashboard 仅在配置令牌后开放同端口 MCP，使用 Bearer 与 loopback Origin 校验，并随宿主监听、重启和关闭维护实例发现记录；现有 MCP、REST 与微信 IDE 自动化入口保持不变。
