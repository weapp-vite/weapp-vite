---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 partial HMR 的 shared chunk 快照流程，优先基于入口索引收敛到受影响的 chunk 闭包，减少大型项目增量更新时对无关 shared chunk 图的重复遍历。
