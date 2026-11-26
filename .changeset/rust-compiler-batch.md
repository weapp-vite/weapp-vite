---
"@weapp-vite/ast-native": patch
"@weapp-vite/ast": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

perf: 复用 Rust 批量 AST 遍历收集页面特性并减少脚本重复分析。
