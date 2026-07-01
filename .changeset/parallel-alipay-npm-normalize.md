---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化支付宝 npm 小程序包后处理，扩展名转换、文本引用重写和嵌套依赖提升改为批量并发执行，减少文件较多依赖包的构建等待。
