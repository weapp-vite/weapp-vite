---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复生产构建中的共享 chunk 包含带哈希依赖模块时被错误重命名为 vendor 文件的问题，确保应用共享 chunk 继续使用配置对应的稳定名称。
