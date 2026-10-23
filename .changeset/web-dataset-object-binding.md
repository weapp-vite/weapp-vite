---
"@weapp-vite/web": patch
---

fix(web): 修复 data-* 绑定对象值时事件回调里的 dataset 退化成字符串的问题，`data-item="{{item}}"` 现在能拿到原始对象。
