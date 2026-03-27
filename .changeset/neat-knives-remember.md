---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的 testing bridge 补充作用域快照读取能力，使 headless 测试可以直接通过会话句柄查看组件作用域状态，而不必依赖页面外部断言路径。
