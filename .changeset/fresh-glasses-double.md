---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的 testing bridge 组件句柄补充父组件等待能力，使嵌套组件测试可以在组件作用域中直接等待宿主组件可用后继续断言。
