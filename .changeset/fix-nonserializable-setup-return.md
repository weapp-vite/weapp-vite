---
"wevu": patch
---

修复 `setup` 返回非可序列化对象导致小程序端更新栈溢出的问题：

- 当 `setup/script setup` 返回值中包含小程序实例等复杂对象时，运行时不再将其纳入 `setData` 快照（改为非枚举属性，仅供 JS 侧访问），避免序列化/遍历时出现 `Maximum call stack size exceeded`。

