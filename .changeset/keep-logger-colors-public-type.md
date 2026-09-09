---
"@weapp-core/logger": patch
---

修复终端染色工具导出声明引用 picocolors 内部类型子路径的问题，使 NodeNext 消费者可以通过公开入口正确解析颜色工具类型。
