---
"weapp-vite": patch
---

fix(vite): 统一 classic 开发宿主与编译会话的根目录，避免 Windows 短路径或目录别名导致文件监听登记使用不同的路径身份，同时保留 `preserveSymlinks` 配置。
