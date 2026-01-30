---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Windows 下 .vue 样式虚拟请求解析导致的构建报错，并改进 /@fs 与路径分隔符处理（含 WXS/WXML 与缓存 key）以提升跨平台兼容性。
