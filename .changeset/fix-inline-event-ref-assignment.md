---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 内联事件表达式中 `<script setup>` 顶层 ref 赋值没有写回 `.value` 的问题，覆盖自增、自减、复合赋值、普通赋值、三元表达式、逗号表达式、函数参数和对象简写等 Vue 3 常见写法，避免小程序运行时点击事件无法正确更新响应式状态。
