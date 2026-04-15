---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一仓库内微信小程序模板与夹具的默认 `appid` 为真实可用值 `wxb3d842a4a7e3440d`，不再保留测试账号或游客账号占位；同时修复 IDE E2E 在扩展 `project.config.json` 时无差别追加末尾空行的问题，避免运行开发者工具验证后产生纯换行噪音改动。
