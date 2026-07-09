---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化入口输出阶段的 HMR 调度：在子入口 chunk 输出期间预取当前入口源码、样式 sidecar 探测结果和样式源码，减少页面脚本变更时串行等待的 IO 时间，同时保持 JSON 注册、layout 注入和样式依赖同步语义不变。
