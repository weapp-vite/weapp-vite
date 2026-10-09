---
"weapp-ide-cli": patch
"@weapp-vite/devtools-runtime": patch
---

修复微信开发者工具混合日志以 BACKEND 记录开头时无法回收测试窗口的问题。新增显式的未完成机器租约恢复入口，在核对原租约、封存作用域和已退出子进程后继续回收；资源清理失败时保留阻塞，防止后续测试累积 IDE 窗口。
