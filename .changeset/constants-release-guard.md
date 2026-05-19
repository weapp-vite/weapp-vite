---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"@wevu/web-apis": patch
"@weapp-vite/ast": patch
"@weapp-vite/dashboard": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
"weapp-vite": patch
"wevu": patch
---

补发共享常量包，并同步提升所有公开依赖包版本，确保新增的 wevu 函数 props 运行时常量会随用户更新一起解析到 npm 最新产物。
