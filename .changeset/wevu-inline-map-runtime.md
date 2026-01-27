---
"wevu": patch
"create-weapp-vite": patch
---

修复内联事件表达式执行器在运行时读取不到 inline map 的问题，确保模板事件可正常触发。
