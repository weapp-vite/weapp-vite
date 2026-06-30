---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发模式文件监听的路径类型识别，减少 HMR 变更处理中的重复后缀扫描和临时数组分配。
