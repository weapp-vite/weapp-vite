---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 自动导入组件时污染源码配置缓存的问题，避免共享模板热更新后保留已失效的组件绑定。
