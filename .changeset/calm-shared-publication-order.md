---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复 classic 热更新在共享模块路径转换前裁剪发布图，导致后续样式或模板更新重新写出无效共享导入路径的问题。
