---
'create-weapp-vite': patch
---

修复 Tailwind 模板在创建项目时可能错误解析到 Tailwind CSS 4 的问题。现在相关模板会显式固定到 `tailwind3` catalog，避免在 `pnpm up` 或 workspace 默认 catalog 升级后漂移到错误的大版本。
