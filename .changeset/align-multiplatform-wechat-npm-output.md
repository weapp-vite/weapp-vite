---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复多平台微信项目默认将小程序 npm 依赖写入项目根目录的问题，使依赖跟随实际构建输出目录，同时保留显式 npm 路径配置。
