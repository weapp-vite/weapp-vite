---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 在 Vite 重启后核验替换宿主已经完成代际交接，避免初始化失败被 Vite 吞掉后误报成功；未交接时关闭本次重启已登记的新宿主，释放其会话与未消费的 HMR 快照，并保留初始化和资源清理错误。
