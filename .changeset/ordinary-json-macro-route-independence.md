---
"weapp-vite": patch
"create-weapp-vite": patch
---

普通 JSON 宏提取不再刷新无关的全局路由上下文，仅在脚本引用自动路由模块时准备路由快照，减少模板更新期间不必要的路由和支持文件操作。
