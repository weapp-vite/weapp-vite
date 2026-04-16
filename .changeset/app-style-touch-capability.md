---
'@weapp-core/shared': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

将 app 样式入口自动补齐策略收敛到 shared 平台描述中，让 `touchAppWxss` 的自动启用逻辑改为消费统一平台能力，便于后续新增宿主时只补 descriptor / adapter 即可。
