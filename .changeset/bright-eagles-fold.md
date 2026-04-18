---
'@weapp-vite/vscode': patch
---

修复 VS Code 扩展在隔离安装态与 `open:vsix:e2e:*` 场景下未默认启用 `weapp-vite File Icons` 的问题，并为独立 `.wxml` 文件补上 Explorer 图标映射与更接近 HTML 文件图标的视觉样式：现在 `weapp-vite.config.*` 会稳定显示专属图标，`index.wxml` 等 WXML 文件也会使用更清晰的折角文件图标，同时安装态 smoke / VSIX 校验会覆盖对应资源与启动配置，避免发布后再次出现图标缺失。
