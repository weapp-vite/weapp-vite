---
"weapp-vite": patch
"create-weapp-vite": patch
---

继续增强小程序文件型热更新的原因解释日志，把 layout 传播、layout 回退全量和 auto-routes 拓扑变化纳入 pending 原因摘要，帮助开发阶段快速判断本次重构建是否由布局依赖或路由拓扑变更触发。
