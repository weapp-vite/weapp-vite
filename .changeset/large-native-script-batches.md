---
"@weapp-vite/ast": patch
"@weapp-vite/ast-native": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 native AST 多脚本批量分析能力，并在 bundle rewrite 热路径预热 chunk 分析缓存，减少 JS 与 Rust 往返次数；同时同步 AI 指南，明确 native 加速优先采用批处理和可回退策略。
