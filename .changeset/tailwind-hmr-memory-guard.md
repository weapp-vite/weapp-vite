---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 在开发模式下每次保存都会刷新虚拟样式请求的问题。现在只有 `<style>` 内容变化时才更新样式请求 HMR token，减少 Tailwind 模板反复保存时触发的 CSS 重处理和内存峰值；同时补充 Tailwind 模板与 e2e app 的 HMR 内存回归守卫。
