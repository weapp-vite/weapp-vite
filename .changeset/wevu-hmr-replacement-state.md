---
"wevu": patch
"create-weapp-vite": patch
---

修复热更新重建宿主实例时丢失显式状态快照的问题，保留 ref、reactive 对象和数组中的交互状态，同时让普通 setup 值使用更新后的代码结果。
