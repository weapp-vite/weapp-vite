---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化入口文件发现流程，JS、JSON、样式、模板和 Vue 入口会并行探测候选扩展并按原优先级选择结果，减少构建和 HMR 中反复入口解析的串行文件等待。
