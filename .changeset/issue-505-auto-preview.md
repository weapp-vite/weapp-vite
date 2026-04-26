---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp auto-preview -p` 在微信开发者工具不在前台时可能无法唤起小程序预览的问题。现在 `auto-preview` 会在执行前先按同一项目定位信息唤起开发者工具，再继续运行官方自动预览命令，提升后台场景下的预览启动稳定性。
