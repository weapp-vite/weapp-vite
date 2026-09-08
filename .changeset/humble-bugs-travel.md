---
"@weapp-vite/web": patch
---

修复 Web 嵌套 scroll-view 内层滚动重复触发外层监听的问题，滚动事件仅由实际滚动的视口派发。
