---
"weapp-vite": patch
"create-weapp-vite": patch
---

缓存未变化的 WXS/SJS 文件转换结果，减少 HMR 和重复构建中模板依赖扫描后的重复文件读取与转换开销。
