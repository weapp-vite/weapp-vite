---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复 classic 配置重启期间关闭原开发构建句柄可能死锁的问题。替换代构建显式保留自己的 sidecar 资源，确保完整关闭已清空监听器登记时，仍能取消迟到的资产扫描并完成清理。
