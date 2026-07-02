---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化入口加载阶段的组件入口归一化结果，提前去重 JSON usingComponents、自动导入和 layout 收集到的重复 entry，减少 build/HMR 中重复 resolve 与重复 chunk emission 判断开销。
