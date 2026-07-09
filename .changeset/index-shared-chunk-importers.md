---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化分包 shared chunk 处理阶段的 importer 解析，预先索引 chunk import 关系，减少多 shared chunk 项目在 build 和 HMR 生成阶段的重复 bundle 扫描。
