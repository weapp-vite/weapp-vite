---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): Windows 上扫描安装根时，受 ACL 保护的目录（如系统应用目录）会让候选发现整体失败并返回 `EPERM: operation not permitted, scandir`，未使用管理员权限的本机与 CI runner 无法完成真实 IDE 前置检查。目录列举现在只把缺失、类型不符和权限拒绝视为“该目录不可扫描”并跳过，显式登记或显式传入的 CLI 仍按原有错误完整上报；非预期的扫描异常继续抛出，不会被吞掉。
