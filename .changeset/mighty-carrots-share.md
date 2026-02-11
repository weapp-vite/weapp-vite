---
"weapp-vite": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

新增 `vue.template.mustacheInterpolation` 配置项，用于统一控制模板 Mustache 输出风格：

- `compact`（默认）：输出 `{{expr}}`
- `spaced`：输出 `{{ expr }}`

该选项会作用于 Vue 模板编译与 JSX/TSX 模板编译中的主要 Mustache 产物位置（如插值文本、动态属性、`v-if`/`v-else-if`、`v-for`、slot 相关元属性等）。默认行为保持不变。

同时保留并兼容 `vue.template.objectLiteralBindMode`：

- `runtime`（默认）：对象字面量 `v-bind` 走运行时中间变量
- `inline`：对象字面量直接内联输出

在 `compact + inline` 下，对象字面量会输出为 `{{ { ... } }}`，用于规避 `{{{` 连续花括号在部分小程序编译链路下的兼容性问题。
