---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复状态保持 HMR 回退 classic 或配置重启时与退出操作相互等待的问题。将单代资源释放与开发会话整体关闭分离，确保直接关闭公共 watcher 也会等待全部监听器和关联服务退出，并保留清理失败，避免退出卡住或微信 IDE 配置未恢复。
