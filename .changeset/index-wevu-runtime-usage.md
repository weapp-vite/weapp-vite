---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 wevu runtime chunk 稳定化阶段的引用扫描，复用一次性索引减少 HMR 与构建输出收尾时的重复 bundle 遍历。
