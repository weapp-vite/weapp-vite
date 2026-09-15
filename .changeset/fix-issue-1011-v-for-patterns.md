---
'@mpcore/simulator': patch
'@wevu/compiler': patch
---

修复 `v-for` 解构默认值与对象剩余属性的降级语义，并让模拟器事件与 selector dataset 保留整段绑定表达式的值类型，确保模板插值、事件参数和真实运行时一致，同时对无法等价转换的模式输出源码定位诊断。
