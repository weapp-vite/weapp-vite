---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 页面与组件入口加载流程，复用已读取的 Vue source 进行 `<script setup>` usingComponents 分析，减少 HMR 与构建入口扫描阶段的重复文件读取。
