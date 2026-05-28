---
"@wevu/compiler": patch
---

在 `<script setup>` 的 `defineProps` 中声明 `id` 时发出编译期提示，提醒迁移用户避开小程序 properties 中可能无法正确取值的保留属性名。
