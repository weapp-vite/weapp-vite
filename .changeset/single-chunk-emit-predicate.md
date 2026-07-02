---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR chunk emit 路径，同一入口只计算一次是否需要 emit chunk，减少每轮热更新中的重复判断。
