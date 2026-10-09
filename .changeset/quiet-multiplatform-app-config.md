---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复多平台微信构建在没有分包时仍输出空 `subPackages` 配置，避免开发者工具初始化分包校验时崩溃。
