---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 classic 开发会话在配置重载后关闭时，错误复用上一代清理结果而遗留独立分包依赖和订阅的问题。新一代只包含依赖元数据时仍执行完整清理，同时保留原始关闭错误、重复关闭语义和项目间资源隔离。
