---
"weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/miniprogram-automator": patch
"create-weapp-vite": patch
---

统一微信开发者工具的 CLI-first 打开流程，默认先打开项目再连接 automator，避免部分 DevTools 版本在自动化启动阶段反复回退。新增 `wv ide doctor` 诊断 CLI、服务端口、登录、项目会话和 DevTools 能力，并改进开发快捷键重复操作提示。
