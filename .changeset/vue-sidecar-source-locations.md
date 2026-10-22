---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复带相邻样式文件的 Vue 入口在首次编译与样式重建之间绑定源码位置漂移的问题，保持样式原生发布并避免纯样式更新改写页面脚本。
