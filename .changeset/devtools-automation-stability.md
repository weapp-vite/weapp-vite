---
"weapp-vite": minor
"create-weapp-vite": minor
"@weapp-vite/miniprogram-automator": patch
"weapp-ide-cli": patch
"@weapp-vite/mcp": patch
---

增强微信开发者工具真实运行时与自动化链路稳定性。新版 DevTools 中 Page 域 RPC 超时后，页面查询、数据读取、setData 和页面方法调用会降级到 App-Service route 查询，避免自动化探针长期卡住；同时完善真实 DOM 与运行时状态验收，降低 request globals 场景的 setData 传输体积，并保持 native 加速能力缺失时的回退路径。
