---
"weapp-ide-cli": patch
---

修复 Windows 进程和开发者工具安装路径包含中文等 Unicode 字符时，PowerShell 默认输出编码损坏路径并导致严格身份核验失败的问题。
