---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复生产构建完成后 native bundler 句柄未释放导致 CLI 进程无法退出的问题，并保持未启用 Rust native AST binding 时的 Babel/Oxc 回退链路可用。
