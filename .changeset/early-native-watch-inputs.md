---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 Vite watch 在语法错误恢复后的首次写出期间可能遗漏后续编辑的问题。提前准备 npm 依赖并登记监听输入，避免写出结束时才新增监听目标；产物继续由宿主原生 emit/write 写出。
