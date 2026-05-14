---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 VS Code 编辑模板项目时 TypeScript 项目图反复重载的问题。模板工作区现在默认排除依赖、构建产物和 `.weapp-vite` 生成目录，根 TypeScript solution 不再主动挂载全部模板项目，同时 `weapp-vite` 在托管 tsconfig 内容未变化时不再重复写盘，减少 TS Server 和 Vue 服务的无效重建。
