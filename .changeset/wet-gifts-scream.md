---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的 testing bridge 组件句柄补充父组件定位能力，使嵌套组件测试可以直接从子组件句柄回溯到其宿主组件并读取宿主作用域快照。
