---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 WXML 中 `import.meta` 整体对象替换到属性插值时的转义策略：当 `import.meta`、对象或数组字面量位于带引号属性的完整 mustache 表达式中时，产物现在会生成带内层字符串字面量且完成属性引号转义的安全形式，避免输出未转义的 JSON 双引号，导致微信开发者工具在编译 `wxml` 时出现语法错误。
