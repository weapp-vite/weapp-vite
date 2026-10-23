---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复原生 Vite 与 Vite+ 在开发宿主重启期间收到 EOF 时可能提前退出、未恢复 IDE 私有配置的问题；同时保留初始化失败的局部清理与重复关闭能力。
