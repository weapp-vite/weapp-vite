---
"@wevu/compiler": patch
---

修复 JSX 内联事件编译产物与运行时 dataset 读取约定不一致的问题：JSX 事件现在会和 Vue 模板一样按事件名输出 `data-wv-inline-id-*`，避免 `bindtap` 等内联处理函数在运行时无法命中，并补齐对应的编译回归测试。
