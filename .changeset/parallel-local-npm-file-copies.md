---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地分包 npm 过滤复制流程，同一目录下的多个文件会并发复制，降低依赖包文件较多时的构建等待时间。
