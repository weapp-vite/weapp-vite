---
"@weapp-vite/web": patch
---

修复 Web 原生 input 未应用 bindinput 处理函数同步字符串返回值的问题，支持空字符串且不改写其他控件、自定义事件或异步返回值。
