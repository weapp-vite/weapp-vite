---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化分包 runtime 本地化的 import 重写流程，将多个 runtime lookup key 合并为一次 importer 更新，减少多分包 build/HMR 生成阶段重复遍历。
