---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 partial HMR 生成阶段的 active entry import 判断，预先索引本轮活跃入口直接引用的 chunk，减少 shared chunk prune 和 rewrite 范围判定中的重复 bundle 扫描。
