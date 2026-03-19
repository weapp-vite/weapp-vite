---
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

修复 `<script setup>` 类型声明 props 在小程序运行时的结构化类型告警回归。`@wevu/compiler` 现在会对类型声明生成的 `Array/Object` 类 props 放宽小程序属性校验，避免作用域插槽等场景下出现误报；`weapp-vite-wevu-tailwindcss-tdesign-template` 中的 `KpiBoard` 也因此可以恢复原本的 `defineProps<...>` 与 `#items` 写法，并在 DevTools e2e 中保持 `warn=0`。
