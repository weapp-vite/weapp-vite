---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 classic 开发进程异常退出后遗留 IDE 配置租约阻塞下次启动的问题。

再次启动时自动恢复已确认退出的持有进程留下的配置租约，保留用户配置修改；对仍在运行的开发命令、旧版或损坏租约提供明确诊断与安全恢复指引。
