---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复微信开发者工具热重载运行时缺少 `DevRuntime` 导致模板启动白屏的问题，并在自动模式下增加兼容性降级与模板回归覆盖。
