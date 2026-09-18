---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复受管 Tailwind CSS 入口同时通过共享样式和 SFC 导入时，原始指令进入 CSS 压缩阶段产生未知规则警告的问题；保留嵌套导入的源文件目录、普通 CSS 压缩及热更新。
