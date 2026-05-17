---
"weapp-vite": patch
---

修复 dev watch 下 `app.vue` app shell 更新时局部产物过滤导致 `__weapp_vite_app_shell` 资产未重新写入的问题，并让新增自动导入组件在 Vite `watchChange` 路径注册后同步刷新引用方，避免页面已注册组件但组件产物缺失。
