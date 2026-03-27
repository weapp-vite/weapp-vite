---
'@mpcore/simulator': patch
---

增强 `@mpcore/simulator` 的 testing bridge 组件表单事件支持，使组件内部节点上的 `input`、`change` 与 `blur` 事件可以在 headless 测试中正确驱动组件实例状态更新。
