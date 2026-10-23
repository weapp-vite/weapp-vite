---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 区分 classic 完整注册图与本次热更新入口，保留共享依赖的完整构建，同时避免单页或组件注册变化被误记为全项目更新。

诊断摘要单独记录实际参与编译的 classic 注册数量，保持增量失效计数可读且不隐去完整注册编译成本。
