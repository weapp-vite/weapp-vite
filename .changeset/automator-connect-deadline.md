---
"@weapp-vite/miniprogram-automator": patch
---

连接开发者工具时，WebSocket 建立与基础库版本检查共用一次超时预算；版本检查失败或预算耗尽时释放尚未交付的连接，避免遗留连接与后续重试重叠。
