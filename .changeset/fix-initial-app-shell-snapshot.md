---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 classic 开发模式首次构建期间保存 `app.vue` 时，应用壳和页面包装使用不同源码版本的问题。首次构建固定 App 及外部块输入，中途修改按顺序进入下一轮构建，无需再次保存即可同步页面模板、组件配置和运行时渲染。
