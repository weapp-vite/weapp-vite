---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复托管 TypeScript 与 Volar 配置：`.weapp-vite/tsconfig.shared.json` 现在固定作为只引用空占位声明的空 project 输出，避免被根 solution references 单独加载时隐式包含全仓库声明文件；模板 VS Code 设置同步启用 Vue Official hybrid mode，提升 `.vue` 文件的 project 归属和跳转稳定性。
