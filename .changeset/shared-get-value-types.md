---
"@weapp-core/shared": patch
---

fix(shared): 补全公开 `get` 导出依赖的 `get-value` 正式依赖声明，使独立安装的消费者能够解析完整类型，并保留上游函数重载与 `Options` 契约。
