---
"weapp-vite": patch
"create-weapp-vite": patch
---

开发服务在 Node IPC 父进程断开时执行正常清理，确保 Windows 自动化宿主也能等待 watcher 和第三方 provider 释放资源。
