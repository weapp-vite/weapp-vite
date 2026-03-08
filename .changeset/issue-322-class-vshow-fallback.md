---
'@wevu/compiler': patch
---

修复模板中 `:class` 与 `v-show` 绑定表达式在首帧访问未就绪对象（如 `errors.email`）时的闪烁问题。现在 class/style 运行时绑定在表达式抛错时会使用更安全的回退值：`class` 保留静态类名，`v-show` 默认回退到 `display: none`，避免先显示后隐藏和样式短暂丢失。同时补充 template 解析阶段的 HTML void 标签处理：当 `input` 等标签未显式书写 `/>` 时，编译器会按自闭合标签解析并输出，避免后续兄弟节点被错误嵌套进 `input`。
