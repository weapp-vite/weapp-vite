---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 `wv dev -o` 在微信开发者工具普通打开回退后继续预热 automator，导致同一次启动内可能重复拉起或关闭重开 DevTools 的问题。
