---
"@weapp-vite/acceptance": patch
"@weapp-vite/mcp": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复验收任务在项目锁释放前发布完成状态导致连续验收被错误拒绝的问题，并在 Windows 报告原子替换遇到短暂文件占用时限时重试，保留清理与持久化失败的诊断。
