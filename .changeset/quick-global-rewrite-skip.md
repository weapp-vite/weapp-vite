---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化构建与 HMR 生成阶段的动态全局对象重写，在 chunk 明显不包含相关模式时提前跳过正则扫描，减少无关 bundle 遍历成本。
