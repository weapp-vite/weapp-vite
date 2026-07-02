---
"weapp-vite": patch
"create-weapp-vite": patch
---

延迟 Vue SFC style-only HMR 的样式块解析，只在确认可复用已有编译结果时读取样式块，减少脚本更新和普通构建中的重复 SFC 解析开销。
