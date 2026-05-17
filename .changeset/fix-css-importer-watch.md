---
"weapp-vite": patch
---

修复 Vue SFC 中 `<style>` 通过 `@import` 引入的样式依赖在 dev watch 下偶发不触发页面样式产物更新的问题。
