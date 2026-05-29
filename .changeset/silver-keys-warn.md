---
"@wevu/compiler": patch
---

在 `<script setup>` 的 `defineProps` 中声明 `id`、`class` 或 `slot` 时发出编译期提示，提醒迁移用户避开小程序 properties 中可能无法正确取值的保留属性名；`style`、`hidden`、`data-*`、`mark:*` 经真实 IDE e2e 验证可作为 prop 传入，不纳入提示范围。
