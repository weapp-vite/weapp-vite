---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 generateBundle 后处理阶段的 bundle 扫描复用，在隐式预加载清理、wevu runtime 重写和 require imports 同步中复用同一轮 chunk 快照，减少大型项目 HMR/构建尾段重复遍历输出 bundle 的开销。
