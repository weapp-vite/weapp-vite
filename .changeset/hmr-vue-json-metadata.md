---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC JSON 宏开发态热更新：当 `definePageJson` / `<json>` 仅修改页面配置时，按 metadata 更新处理并跳过 shared chunk 入口扇出，避免标题等配置变更触发多页面重构建。
