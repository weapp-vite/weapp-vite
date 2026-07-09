---
"weapp-vite": patch
"create-weapp-vite": patch
---

将本地 npm 的 JSON usingComponents 重写收敛为单次 bundle 分派，减少多分包构建和 HMR 生成阶段的重复 JSON asset 遍历。
