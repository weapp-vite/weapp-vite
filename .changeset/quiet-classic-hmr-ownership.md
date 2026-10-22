---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 区分 classic 完整注册图与本次热更新入口，保留共享依赖的完整构建，同时避免单页或组件注册变化被误记为全项目更新。
