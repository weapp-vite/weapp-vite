---
'weapp-vite': patch
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

为 `weapp-vite` 增加开发态可选的输出目录清理开关 `weapp.cleanOutputsInDev`。当其为 `false` 时，`dev` / `dev -o` 启动前不会先全量清空小程序输出目录，从而减少大项目或模板示例在开发模式下的磁盘清理开销。同步在 `weapp-vite-wevu-tailwindcss-tdesign-template` 模板中启用该选项，以优化本地开发启动体验。 
