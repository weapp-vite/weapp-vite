---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复直接使用 Vite 或 Vite+ 开发时，classic 回退尚未完成宿主交接就退出，导致微信 IDE 私有配置未恢复的问题。退出现在等待整条宿主链完成资源清理与配置恢复，初始化失败仍可局部清理，并保留同时发生的重启错误。
