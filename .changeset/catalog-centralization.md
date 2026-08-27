---
'@weapp-vite/web': patch
'create-weapp-vite': patch
---

将多个工作区共享依赖集中到 pnpm catalog，并同步脚手架模板的依赖映射，后续升级无需重复修改大量 package.json。
