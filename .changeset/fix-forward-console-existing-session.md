---
'weapp-vite': patch
'create-weapp-vite': patch
'weapp-ide-cli': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/mcp': patch
'@wevu/compiler': patch
'wevu': patch
'@wevu/web-apis': patch
'@mpcore/simulator': patch
---

修复真实微信开发者工具自动化中的会话复用、页面重启、日志收集与截图清理稳定性问题，避免 `forwardConsole` 重复连接现有会话，并降低完整 IDE E2E 在组件库和 GitHub issue 回归场景中的重复启动成本。
