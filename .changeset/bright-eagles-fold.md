---
'@weapp-vite/vscode': patch
---

为 VS Code 扩展补上独立 `.wxml` 文件的 Explorer 图标映射与更接近 HTML 文件图标的视觉样式，并保留 `weapp-vite File Icons` 的手动启用能力：现在用户可按需切换到该文件图标主题，让 `weapp-vite.config.*` 显示专属图标、`index.wxml` 等 WXML 文件显示更清晰的折角文件图标；同时安装态 smoke / VSIX 校验会覆盖对应资源与启动配置，避免发布后再次出现图标缺失。
