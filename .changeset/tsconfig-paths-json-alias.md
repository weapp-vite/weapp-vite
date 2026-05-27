---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `compilerOptions.paths` 的默认解析链路：即使项目没有配置 `baseUrl`，也会按 tsconfig 所在目录解析别名；同时将 `paths` 自动作为 JSON `usingComponents` 的默认别名，避免 JS/TS 与 JSON 配置需要重复维护路径映射。若需要完全关闭 JSON 别名，可配置 `weapp.jsonAlias=false`。
