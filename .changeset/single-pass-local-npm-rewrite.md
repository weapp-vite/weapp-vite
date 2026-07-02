---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地 npm 依赖重写的生成阶段处理，将主包与分包 chunk 的重复 bundle 扫描收敛为单次分组遍历，减少多分包项目构建与 HMR 生成阶段的无关遍历成本。
