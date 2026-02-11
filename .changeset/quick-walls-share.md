---
"weapp-vite": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

新增 `vue.template.objectLiteralBindMode` 配置项，用于控制对象字面量 `v-bind` 的产物模式：

- `runtime`（默认）：保持现有行为，使用运行时中间变量（如 `__wv_bind_0`）
- `inline`：直接内联对象字面量，并输出为 `{{ { ... } }}`（插值两侧补空格，避免出现 `{{{`）

这可以兼容旧项目在小程序端对连续三个花括号的编译限制，同时默认行为保持不变。
