---
"@weapp-vite/vscode": patch
---

修复 VSCode 扩展相关回归测试在 Windows CI 下的路径与命令兼容性问题，避免发布前校验被平台差异误拦截。
