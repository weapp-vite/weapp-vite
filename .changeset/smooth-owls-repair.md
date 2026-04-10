---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 WXML 中 `import.meta.url`、`import.meta.dirname` 与 `import.meta.env` 替换到属性插值时的转义行为：当替换值为对象或 JSON 内容时，现在会输出为合法的字符串字面量并转义属性引号，避免生成的小程序 WXML 因出现未转义的 `"` 而在微信开发者工具中编译失败。
