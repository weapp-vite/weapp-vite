---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复带作用域参数的 `<slot name="...">` 输出只保留泛型作用域插槽、丢失原生命名 slot 投影兜底的问题，确保微信开发者工具中没有作用域 owner 时仍能显示默认 fallback 内容。
