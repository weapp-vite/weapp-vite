---
"@weapp-vite/web": patch
---

Web 端新增导航栏对齐能力：构建期注入 `weapp-navigation-bar`，并补齐 `wx.setNavigationBarTitle/setNavigationBarColor/showNavigationBarLoading/hideNavigationBarLoading` 等 API 以支持安全区与样式更新。
