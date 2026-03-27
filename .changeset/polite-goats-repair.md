---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的 testing bridge 组件句柄补充直接方法调用能力，使测试可以不经过节点事件分发，直接驱动组件实例方法并观察页面与组件状态变化。
