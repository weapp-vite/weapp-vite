'weapp-vite': patch
'create-weapp-vite': patch
---

修复仅包含 `<script setup>` 的 Vue 页面在自动注入 Web Runtime 全局能力时被错误跳过的问题。现在 issue #448 这类页面会正确注入 `atob`、`btoa`、`queueMicrotask`、`performance`、`crypto`、`Event`、`CustomEvent` 对应的 runtime installer，并补齐构建回归与微信开发者工具 e2e 覆盖，避免页面在 attached 阶段因全局能力未初始化而挂载失败。
