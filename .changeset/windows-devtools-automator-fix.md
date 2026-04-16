---
"@weapp-vite/miniprogram-automator": patch
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Windows 上通过微信开发者工具 automator 打开项目时的启动与信任流程问题，补齐默认 CLI 路径探测、批处理启动兼容、服务端口与项目信任预写入，以及调试回退时的错误定位能力。
