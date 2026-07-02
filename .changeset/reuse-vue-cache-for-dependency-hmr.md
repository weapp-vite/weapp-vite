---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化依赖型 HMR 更新下的 Vue SFC 编译缓存复用：当 shared chunk 源模块变更只让 Vue 入口作为依赖刷新时，继续复用未变化的 SFC 编译结果，减少重复 Vue compiler 开销。
