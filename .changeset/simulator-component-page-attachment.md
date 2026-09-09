---
"@mpcore/simulator": patch
---

修复使用 Component 注册的页面挂载晚于后代组件的问题，在页面 onLoad 前独立执行页面自身的 created 与 attached，使子组件首次挂载即可读取页面上下文，并保留原生 Page 的组件生命周期顺序。
