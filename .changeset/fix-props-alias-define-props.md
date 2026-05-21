---
"@wevu/compiler": patch
"wevu": patch
---

修复 `<script setup>` 中 `defineProps` 解构重命名后，模板运行时绑定和自动生成的 class/style computed 无法读取原始 prop 值的问题。
