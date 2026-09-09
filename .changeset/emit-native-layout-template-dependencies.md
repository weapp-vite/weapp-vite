---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic HMR 在原生 layout 没有独立入口时遗漏共享模板输出的问题。增量构建根据页面登记的 layout 依赖选择模板，并继续展开嵌套 import/include，使共享模板修改后的扫描结果正确进入构建产物。
