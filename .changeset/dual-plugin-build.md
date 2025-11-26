---
"weapp-vite": minor
---

feat: 构建插件时自动读取 `project.config.json.pluginRoot`，并为插件与主小程序分别启动独立的 rolldown-vite 构建上下文，确保产物写入各自目录且互不干扰。
