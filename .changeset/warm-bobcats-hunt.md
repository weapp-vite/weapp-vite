---
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu 运行时在微信开发者工具热重载场景下可能产出无原型对象，导致 scoped slot 与 setData 快照参与 WXML 更新时触发 `hasOwnProperty is not a function` 报错的问题。
