---
'wevu': patch
'create-weapp-vite': patch
---

修复 `defineOptions({ externalClasses: [...] })` 在 wevu `<script setup>` 宏中的类型提示缺失问题，并为 `weapp-vite-wevu-tailwindcss-tdesign-template` 增加 `virtualHost` 与外部样式类透传实验页，方便验证 `externalClasses`、`custom-class` 与 `rootStyle` 的推荐写法。
