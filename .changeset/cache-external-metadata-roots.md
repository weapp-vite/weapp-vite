---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化自动导入外部组件 metadata 预加载时的包根目录解析缓存，减少全量 resolver 组件扫描中的重复模块解析开销。
