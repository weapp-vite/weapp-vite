---
"@mpcore/simulator": patch
---

修复组件 `triggerEvent` 错误继承内部原生按钮 `target` 的问题。自定义事件的 `target` 与 `currentTarget` 使用组件宿主的 id 和 dataset，转发的原生事件保留在 detail 中，恢复 TDesign 弹窗取消与确认等依赖宿主 dataset 的交互。
