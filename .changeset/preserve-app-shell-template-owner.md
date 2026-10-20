---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 app.vue 逻辑入口重建时丢失自身模板依赖的问题，使应用 shell 模板修改、移除或新增后发布新的原生构建代际，避免模板资产已更新而 App 脚本仍属于旧构建。
