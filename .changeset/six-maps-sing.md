"@weapp-vite/vscode": patch

修复 VS Code 扩展在 monorepo 中解析 rooted `usingComponents` 时的误报。现在当子项目使用 `app.config.*` 而不是 `app.json` 时，扩展会基于最近的 `weapp-vite` 项目根定位组件文件，不再把 `/native/...` 这类路径错误地解析到当前 `.vue` 文件目录下。
