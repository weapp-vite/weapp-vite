---
'@mpcore/simulator': patch
---

增强 `@mpcore/simulator` 的 testing bridge 组件事件分发能力，使测试中命中的组件内部节点可以按作用域调用对应组件实例方法，并正确回流到页面事件断言。
