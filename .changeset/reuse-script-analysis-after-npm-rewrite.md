---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 npm import rewrite 后的脚本分析缓存，避免同一 chunk 在后续平台 API rewrite 中因为代码字符串更新而重复执行 batch AST analysis，降低 build 与 HMR 生成阶段的重复扫描成本。
