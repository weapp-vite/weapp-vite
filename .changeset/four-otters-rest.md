---
'@mpcore/simulator': patch
---

修复 `@mpcore/simulator` 在直接调用组件方法后触发 `triggerEvent` 时复用旧交互目标的问题。现在 browser runtime、headless runtime 与 Web demo bridge 在无显式事件上下文的直接组件方法调用下，都会回落到组件宿主节点作为事件目标，避免把上一次内部节点交互的 `target` 泄漏到新的组件事件里。
