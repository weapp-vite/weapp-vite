---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 wevu runtime import rewrite 的 runtime chunk 解析，复用一次性索引减少生成阶段重复扫描。
