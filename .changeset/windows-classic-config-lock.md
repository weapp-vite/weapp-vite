---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Windows 下 classic IDE 配置锁竞争时偶发的 EPERM 退出。

在既有竞争预算内处理持锁者已释放 guard 的情况，持续权限故障保留原始错误，并继续核验所有权后才恢复或清理配置。

并发回收已确认死亡的持有者时，对同一旧 token 的瞬态删除冲突共用原竞争预算重试；预算耗尽、其他权限错误及当前持有者的释放错误仍原样保留，迟到回收不会删除替换持有者。
