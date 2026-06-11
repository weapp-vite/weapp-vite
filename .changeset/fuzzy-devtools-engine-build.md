---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 `wv dev -o` 打开微信开发者工具时频繁提示不支持自动 engine build 刷新的问题。现在 HTTP engine build 接口不可用时会回退到官方 CLI 刷新项目，减少启动 warning 并避免模拟器继续读取旧状态。
