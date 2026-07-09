---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享样式依赖 HMR：`css-importer` 场景只选择一个代表入口触发 bundler 重建，同时保留全部受影响入口用于样式产物刷新，减少共享 Sass / Less 依赖更新时的重复入口 emit。
