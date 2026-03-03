---
'@wevu/compiler': patch
---

修复 `defineOptions` 参数内联模块的 TypeScript 类型定义：序列化内置构造器映射时，原类型仅允许“可调用函数”，会导致 `WeakMap` / `WeakSet` 等仅可构造对象出现类型不兼容。现已调整为同时支持“可调用或可构造”类型，消除该文件的类型报错且不改变运行时行为。
