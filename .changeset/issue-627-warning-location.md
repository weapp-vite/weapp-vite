---
"@wevu/compiler": patch
---

增强 `<script setup>` 中 `defineProps` 声明 `id/class/slot` 时的编译期提示，warning 现在会带上 SFC 文件路径与行列号，方便从终端或 IDE 日志一键定位到需要修改的位置。
