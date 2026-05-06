---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复布局入口共享 WXML/WXS 侧车文件在 HMR 更新时没有完整标记依赖页面与共享 chunk importer 的问题，避免局部重编后页面引用到未重新导出的共享模块。
