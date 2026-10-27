---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 等待 classic 开发模式启动期间已接收的源码变更完成发布后再报告就绪，避免首屏之后仍有启动重建改写脚本，干扰后续样式热更新的产物与运行时验证。
