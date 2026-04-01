---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `injectRequestGlobals` 在 `.vue` 入口上的脚本注入方式：当 SFC 已经同时存在 `<script setup>` 与普通 `<script>` 时，`weapp-vite` 现在会把请求全局安装代码注入到现有脚本块内部，而不是再额外拼接一个新的 `<script>`，从而避免触发 Vue 的 “Single file component can contain only one <script> element” 解析错误。与此同时补充回归测试，并让 `request-clients-real` 的 `app.vue` 以双脚本形态稳定通过构建与 IDE runtime e2e。
