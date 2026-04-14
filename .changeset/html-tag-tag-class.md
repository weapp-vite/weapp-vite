---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为 Vue 模板的 `htmlTagToWxml` 转换补充默认标签语义 class 注入能力：当 `.vue` 中的 HTML 标签被转换为小程序内置标签时，会默认追加原标签名 class（如 `h3 -> <view class="h3">`、`br -> <view class="br" />`），便于用户自行用 CSS 低成本恢复默认外观；同时新增 `vue.template.htmlTagToWxmlTagClass` 开关，支持按需关闭该行为。
