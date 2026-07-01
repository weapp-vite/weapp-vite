---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 npm 小程序包文件收集流程，扫描依赖包目录树时同一层级目录并发读取，减少复制后兼容处理和支付宝缓存检测的等待时间。
