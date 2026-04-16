---
'weapp-vite': patch
'create-weapp-vite': patch
---

让多平台模式下 `--project-config` 的报错提示复用平台真实项目配置文件名，像支付宝和百度等平台会分别指向 `mini.project.json`、`project.swan.json`，避免提示路径与实际加载规则不一致。
