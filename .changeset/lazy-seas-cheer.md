---
"@wevu/compiler": patch
---

修复内联事件编译产物与运行时 dataset 读取约定不一致的问题：Vue 模板与 JSX 事件现在都会按事件名输出 `data-wv-inline-id-*`，避免 `@click` / `bindtap` 等内联处理函数在运行时无法命中，并补齐对应的编译与运行时回归测试。
