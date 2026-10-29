---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Windows 下 classic IDE 配置锁竞争时偶发的 EPERM 退出。

在既有竞争预算内处理持锁者已释放 guard 的情况，持续权限故障保留原始错误，并继续核验所有权后才恢复或清理配置。
