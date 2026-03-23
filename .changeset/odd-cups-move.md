---
'weapp-vite': patch
'create-weapp-vite': patch
---

恢复 `weapp-vite` 在开发模式下默认会先清空输出目录的行为，同时保留 `weapp.cleanOutputsInDev` 作为显式开关。现在只有当项目明确设置 `cleanOutputsInDev: false` 时，`dev` / `dev -o` 才会跳过启动前的输出目录清理，以兼顾既有语义与可选优化能力。
