---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `compilerOptions.paths` 的默认解析链路：即使项目没有配置 `baseUrl`，也会按 tsconfig 所在目录解析别名。JSON `usingComponents` 不再默认继承 tsconfig paths，仍需通过 `weapp.jsonAlias.entries` 显式配置，避免 JS/TS 解析别名误影响小程序组件路径。
