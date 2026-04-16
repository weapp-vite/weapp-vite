---
'weapp-vite': patch
'create-weapp-vite': patch
---

让页面 layout 动态包裹分支改为按平台描述选择模板指令前缀，避免 `pageLayout` 在支付宝等平台上继续默认生成 `wx:if` / `wx:else`。
