---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 的高频构建与 HMR 插件钩子补充 Rolldown hook filter，减少无关模块进入 JS 插件处理路径，提升增量更新与构建时的插件调度效率。
