---
'weapp-vite': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` / `@wevu/compiler` 在 `.vue` 文件源码调试链路中丢失脚本 sourcemap 的问题。现在 Vue SFC 的 `compileScript`、wevu 脚本重写、页面特性注入、`setData.pick` 注入以及最终入口代码拼装会连续传递并组合 sourcemap，避免 `app.vue`、页面与组件在开发者工具里出现不同程度的断点行号偏移。
