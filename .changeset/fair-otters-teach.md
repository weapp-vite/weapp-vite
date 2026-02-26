---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 组件侧 `pageLifetimes.routeDone` 的生命周期桥接，确保在组件中可通过 `onRouteDone` 正常接收页面路由动画完成事件；同步补齐相关运行时测试与文档映射说明（`lifetimes/pageLifetimes` 与组合式 API 的对应关系），避免与微信官方生命周期定义不一致。
