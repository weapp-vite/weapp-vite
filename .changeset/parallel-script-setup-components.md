---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue `<script setup>` 自动 usingComponents 的解析流程，同一文件中的多个组件导入会并行解析并按原导入顺序写回配置，减少页面和组件入口加载时的串行等待。
