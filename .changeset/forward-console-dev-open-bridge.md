---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 `dev -o` / `dev:open` 场景下 forwardConsole 可能显示已连接但无法持续收到微信开发者工具控制台日志的问题。现在日志桥会优先绑定项目专属 automator 会话，并在普通 open 回退场景下自动连接已打开的开发者工具会话，同时保持日志订阅可用，避免打开或编译后的页面上下文刷新导致终端不再收到小程序日志。

同时调整微信开发者工具打开后的项目稳定流程，默认不再调用 DevTools `/v2/resetfileutils`，避免每次打开项目时触发 `wx.saveFile` / `wx.removeSavedFile` 废弃 API 警告；如确需恢复旧的 fileutils 重置行为，可通过 `WEAPP_VITE_RESET_IDE_FILEUTILS=1` 显式开启。
