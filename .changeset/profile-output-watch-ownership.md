---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式首次构建失败后，HMR profile 自身写入可能反复触发失败重建的问题。监听与事件入口仅排除当前实际启用的 profile 输出文件，并与写入方共用配置、环境变量及路径解析，保留关闭 profile 时的同名用户文件和相邻源码事件。
