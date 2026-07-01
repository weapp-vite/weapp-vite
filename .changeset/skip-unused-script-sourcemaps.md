---
"wevu-compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

在未启用 Vite sourcemap 的默认构建与 HMR 路径中跳过 Vue/JSX 脚本转换和后续注入阶段的 sourcemap 生成，减少 Babel codegen 的额外开销；显式开启 sourcemap 时仍保留原有映射输出。
