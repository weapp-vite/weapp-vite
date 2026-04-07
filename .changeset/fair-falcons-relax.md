---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 组件事件在空 payload 场景下的模板参数契约不一致问题。此前父组件通过直接 handler 或显式 `$event` 监听 `emit('empty')` 时，可能拿到整个事件对象而不是 `undefined`；现在在启用 `detail` 解包标记的组件事件中，空 payload 会和普通 payload 一样统一按 `detail` 语义传递，同时补充了编译产物、单元测试与微信开发者工具运行时验证，覆盖 direct handler、显式 `$event`、内联 `$event.title`、原生事件透传、tuple payload 与带 options 的 `emit` 写法。
