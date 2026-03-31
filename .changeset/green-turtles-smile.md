---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` CLI 在读取 `vite.config.ts` / `weapp-vite.config.ts` 时因 Vite `bundle` 配置加载器误走 `require` 而无法解析纯 ESM `weapp-vite` 入口的问题，避免 `apps/plugin-demo` 这类示例项目在执行 `pnpm dev` 时出现配置加载失败。同时为 `plugin-demo` 示例补充 `"type": "module"` 声明，减少 Vite 8 下的模块类型歧义。
