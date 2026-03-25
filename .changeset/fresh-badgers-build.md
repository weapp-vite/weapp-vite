---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `wevu` Vue SFC 页面在 `<script setup>` 中通过默认 `@/` 别名导入组件时，自动生成的 `usingComponents` 路径被错误拼成页面相对路径的问题，避免构建时出现找不到组件入口文件的告警。
