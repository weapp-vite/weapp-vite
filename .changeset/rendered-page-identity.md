---
"@weapp-vite/miniprogram-automator": patch
"@mpcore/simulator": patch
---

为测试页面提供只读的 `pageId`，重新查询同一页面时保持稳定，同路由重新创建页面时生成独立身份，防止验收工具把旧页面的渲染结果归入新页面。
