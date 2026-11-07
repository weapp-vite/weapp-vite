---
"weapp-vite": patch
---

fix(weapp-vite): 修复 classic HMR 交接期间原生样式保存事件未传递到主构建的问题，保留辅助模块图的文件更新观察并隔离第三方插件生命周期。
