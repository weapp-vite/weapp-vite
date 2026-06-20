---
"@wevu/api": patch
---

修复微信平台下 `wpi.saveFile` 与 `wpi.removeSavedFile` 会触发开发者工具废弃 API 告警的问题；现在会通过 `wx.getFileSystemManager()` 获取文件管理器后调用对应方法，避免访问已废弃的 `wx.saveFile` / `wx.removeSavedFile` 全局 API。
