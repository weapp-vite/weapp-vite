---
"@weapp-vite/miniprogram-automator": patch
---

修复新版微信基础库中控制台日志转发依赖 IDE Console 面板开启的问题。日志初始化主动启用 Runtime 日志域，并保留旧版基础库的 console 包装兼容路径；合并并发初始化，保留超时预算与失败后的重试能力。
