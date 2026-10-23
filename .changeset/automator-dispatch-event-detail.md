---
"@weapp-vite/miniprogram-automator": patch
---

fix(automator): 修复 `Element.dispatchEvent()` 未将公开的 `detail` 参数映射为微信开发者工具协议 `eventData` 的问题，确保输入等通用事件能收到完整数据，并保留现有触摸事件旁路。
