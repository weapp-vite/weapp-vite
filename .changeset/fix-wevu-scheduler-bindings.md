---
"create-weapp-vite": patch
"wevu": patch
---

修复 `shallowRef` 强制触发、调度队列续刷和编译绑定取值优先级，确保连续响应式更新及 setup/data/props 同名绑定能稳定同步到小程序视图。
