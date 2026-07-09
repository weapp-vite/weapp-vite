---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 入口加载流程，当已读取的模板源码不包含可能的自动组件标签时跳过 `<script setup>` usingComponents 的额外 SFC 解析，减少普通页面 HMR 与构建扫描开销。
