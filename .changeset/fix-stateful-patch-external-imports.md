---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复引用 TDesign 等原生 npm 组件的页面在状态保持热更新时生成非法模块导入的问题。更新载荷使用与首包一致的宿主路径和模块互操作，并隔离保留批次的局部绑定，避免连续更新互相覆盖。
