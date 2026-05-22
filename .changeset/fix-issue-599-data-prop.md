---
"@wevu/compiler": patch
---

修复模板中名为 `data` 的 props 在自动 class/style 或复杂绑定 computed 中被误解析为运行时 state 别名的问题，确保 `data.xxx` 会优先读取同名 props。
