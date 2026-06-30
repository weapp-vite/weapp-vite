---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化自动导入开发启动路径：`wv dev` 初始构建不再阻塞等待全量 resolver 组件 IDE 支持文件输出，并减少第三方组件 metadata / navigation import 解析中的重复模块解析与文件探测。
