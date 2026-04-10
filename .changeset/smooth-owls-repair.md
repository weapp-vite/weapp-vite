---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 WXML 中 `import.meta.url`、`import.meta.dirname` 与 `import.meta.env` 替换到属性插值时的生成规则：字符串值继续输出为带引号的字符串字面量；对象、数组、布尔值等完整 mustache 表达式现在统一输出为 `{{ { ... } }}` / `{{ true }}` 这类合法字面量形式，避免生成 `{{{` / `}}}` 或未转义引号后在微信开发者工具中编译失败。
