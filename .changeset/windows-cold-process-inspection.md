---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 将 Windows 进程身份查询的默认总预算调整为 30 秒，涵盖 PowerShell 冷启动和内核或 CIM 初始化，避免在查询脚本尚未开始执行时误报失败。调用方指定的更短预算和取消信号继续优先，查询超时或身份不完整时仍拒绝清理资源。
