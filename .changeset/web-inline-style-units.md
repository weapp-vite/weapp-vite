---
"@weapp-vite/web": patch
---

fix(web): 修复 WXML 内联 style 的 rpx / vw / vh 未换算导致声明被浏览器丢弃的问题，模板里的 `style="height:200rpx"` 现在与 WXSS 保持一致。
