---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复状态保持 HMR 在原生完整构建回调只包含变更文件时误删未变化产物的问题，并确保跨场景重建仍能保留完整的输出归属和客户端确认。
