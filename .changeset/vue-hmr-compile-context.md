---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 与 JSX 热更新期间的编译状态混用问题。静态快照使用独立编译上下文，不再清空活动 DevEngine 的组件注册和模块依赖；JSX 源码 sidecar 通过兼容补丁更新，避免共享片段或页面事件修改触发组件 chunk 发射失败与完整重载。模块查询和失效分析统一使用 DevEngine 构建图，编译选项保持当前构建钩子的解析和发射上下文。
