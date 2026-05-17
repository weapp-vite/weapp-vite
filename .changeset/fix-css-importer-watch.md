---
"weapp-vite": patch
---

修复 Vue SFC 中 `<style>` 通过 `@import` 引入的样式依赖在 dev watch 下偶发不触发页面样式产物更新的问题，并让小程序 dev watch 在快速原子保存时先收敛文件事件再重建，避免 macOS 上连续写入偶发读到中间态。
