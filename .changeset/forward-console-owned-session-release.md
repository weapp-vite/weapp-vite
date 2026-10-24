---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-ide-cli): 修复非交互开发命令关闭日志转发后仍保留空闲自动化连接的问题，使开发进程能正常退出，同时保留其他会话正在使用的连接。
