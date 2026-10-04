---
"@mpcore/simulator": patch
"@weapp-vite/miniprogram-automator": patch
---

为无头自动化会话补齐同步、幂等的 disconnect 生命周期接口，使共享连接释放与启动取消后的迟到资源清理能够正确释放所属 runtime，保留其他项目会话。
