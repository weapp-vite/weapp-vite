---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 asset 插件生成阶段，在没有待复制资产或已被 bundle 覆盖时跳过 module graph 全量扫描。
