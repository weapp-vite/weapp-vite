---
'weapp-vite': patch
'create-weapp-vite': patch
---

让 Vue transform 的 `setData.pick` 注入判断按平台模板指令前缀生效，避免支付宝等平台仍只按 `wx:` 提示动态模板。
