---
'weapp-vite': patch
---

整理 `configPlugin` 的内置别名逻辑，提取 @oxc-project/runtime 与 class-variance-authority 的处理，修复类型声明并避免外部构建解析报错。
