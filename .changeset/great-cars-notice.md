---
'weapp-vite': patch
'@weapp-vite/web': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 在生成 DTS 时对 `@weapp-vite/web` 类型导出的解析问题：为 `@weapp-vite/web` 增加稳定的 `./plugin` 子路径导出，并让配置类型改为从该子路径引用 `WeappWebPluginOptions`，避免构建类型声明时出现缺失导出报错。
