---
'@mpcore/simulator': patch
---

完善 `@mpcore/simulator` 中组件事件对象的对齐行为，使 testing bridge 命中组件内部节点后，冒泡到页面的事件可以保留更准确的 `target`、`currentTarget` 与 `mark` 信息。
