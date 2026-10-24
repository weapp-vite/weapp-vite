---
"weapp-ide-cli": patch
---

fix: 修复 Linux 进程在身份检查期间退出时 ESRCH 错误中断受管资源清理的问题，保留其他读取错误和启动身份校验。
