---
"wevu": patch
"create-weapp-vite": patch
---

修复 `6.16.21` 起 `<script setup>` props 解构派生字段可能作为同名顶层 `setData` 数据回写的问题，避免小程序属性 observer 与 wevu props 同步之间形成重复触发循环；同时保留 props 别名字段在模板中的正常渲染更新。
