---
"weapp-vite": minor
"rolldown-require": major
"create-weapp-vite": major
"@weapp-vite/mcp": major
"vite-plugin-performance": major
"@weapp-vite/volar": major
"weapp-ide-cli": major
"@weapp-vite/web": major
"wevu": minor
"@weapp-core/init": major
"@weapp-core/logger": major
"@weapp-core/schematics": major
"@weapp-core/shared": major
---

改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。

- `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
- `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。
