---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 编译中解析已存在的相对文件 chunk 时仍进入 Vite tsconfig paths resolver 的问题，避免 monorepo clean CI 下误读取无关工作区应用缺失的 `.weapp-vite` 受管 tsconfig。
