---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 扫描微信开发者工具安装目录时忽略无权限的受保护目录，修复 Windows 上因 `Program Files\WindowsApps` 返回 EPERM 导致安装发现与 IDE 自动化整体失败的问题。
