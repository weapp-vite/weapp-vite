---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化支付宝 npm 小程序包缓存检测，文本文件 stale 判断和嵌套依赖存在性检查改为批量并发执行，减少缓存命中判断等待。
