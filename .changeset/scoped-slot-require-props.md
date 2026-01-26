---
"weapp-vite": patch
"create-weapp-vite": patch
---

仅在 v-slot 传递作用域参数时生成 scoped slot 组件，普通具名插槽回退为原生 slot；新增 weapp.vue.template.scopedSlotsRequireProps 配置以切换旧行为。
