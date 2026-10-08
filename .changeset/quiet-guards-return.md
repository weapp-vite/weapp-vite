---
"@weapp-vite/devtools-runtime": patch
---

在 Windows 上为 recovery guard 的目录获取 EPERM 沿用既有期限重试，避免临时获取失败中断 journal 关闭；仍仅在原子创建成功后进入临界区，超时保留原错误且不删除其他持有者的 guard。
