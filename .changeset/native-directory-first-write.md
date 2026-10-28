---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(watcher): 修复 macOS 原生目录监听就绪后可能遗漏首次侧车文件写入的问题。目录注册批次共用一个自有临时监听完成原生握手，再通过原协调队列恢复扫描，避免为每个初扫文件持有额外句柄。
