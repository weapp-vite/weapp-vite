---
"@wevu/compiler": patch
---

修复仅使用 `<script setup>` 的 wevu 组件在构建时缺少默认导出的问题，避免页面通过默认导入引用组件时触发 bundler 的 missing export 错误。
