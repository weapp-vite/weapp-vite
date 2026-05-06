---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复无 tsconfig 项目中使用 TypeScript 配置文件时，Vite runner 加载器可能因 Oxc tsconfig 解析失败而中断配置加载的问题。
