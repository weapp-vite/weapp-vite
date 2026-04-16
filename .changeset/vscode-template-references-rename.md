---
'@weapp-vite/vscode': patch
---

增强 VS Code 扩展中 WXML 与识别到的 weapp-vite Vue 模板的 references / rename 能力。现在从模板中的表达式、事件处理函数与 `wx:for` 局部变量位置发起时，可以同时查找模板内引用，并联动当前页脚本或伴生脚本中的同名符号进行引用查询与重命名。
