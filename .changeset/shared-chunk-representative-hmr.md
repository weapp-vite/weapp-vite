---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared chunk 源码依赖的 HMR：当一次更新只影响共享 chunk 本身时，仅选择代表入口触发 bundler 刷新，同时保留所有受影响入口作为 HMR 活跃范围，减少多入口重复 emit 带来的构建开销。
