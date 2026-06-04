---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复干净 CI 环境中小程序构建会被工作区根 `tsconfig` references 牵引到缺失 `.weapp-vite` 支持文件的问题，确保受管 TypeScript 项目在构建前完成必要的 tsconfig bootstrap。
