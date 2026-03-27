---
'create-weapp-vite': patch
---

为 `create-weapp-vite` 生成的项目补充 `rolldown` 版本约束，默认写入 `pnpm.overrides`、`overrides` 与 `resolutions`，避免用户项目在安装依赖时重新解析到 `1.0.0-rc.12`。
