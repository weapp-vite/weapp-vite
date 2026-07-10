---
"@weapp-vite/ast": minor
"@weapp-vite/ast-native": patch
"weapp-vite": minor
"create-weapp-vite": minor
---

新增可选的 native AST 批量分析与性能评估能力，将同一份脚本上的多项静态检查合并为一次 JS 与 Rust 通信和一次解析，并在 bundle rewrite 热路径复用分析缓存。native binding 未配置、加载失败或执行失败时继续回退 Babel、Oxc 与 Vue compiler 路径，保持现有构建兼容性。
