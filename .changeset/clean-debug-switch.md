---
"weapp-vite": patch
"@weapp-vite/miniprogram-automator": patch
"@weapp-vite/dashboard": patch
"create-weapp-vite": patch
---

将内部调试日志依赖从 `debug` 替换为更轻量的 `obug`，同步脚手架依赖 catalog，并升级 dashboard 路由相关依赖类型以保持当前依赖版本兼容。
