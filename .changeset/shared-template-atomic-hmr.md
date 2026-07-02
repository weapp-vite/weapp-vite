---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复共享 WXML / WXS 依赖在原子保存时的 HMR：当编辑器以 create 事件落盘已存在的模板或 WXS 文件时，开发服务会按更新事件重新扫描依赖、刷新引用方并写出对应共享资源，避免 import/include 的模板更新等待超时。
