---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 修复微信 CLI 操作结束后暂停非交互输入流的问题，使开发命令能正常收到管道 EOF 并完成退出清理。
