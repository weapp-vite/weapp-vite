---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 在复用 Vue 编译缓存时向当前构建重新声明 scoped-slot 脚本入口，避免 classic 回退后的后续构建删除仍被页面引用的插槽组件。
