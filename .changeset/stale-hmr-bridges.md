---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu 页面在微信开发者工具 stateful HMR 中的原生注册与运行时刷新衔接问题，避免已装饰的生命周期定义被再次写回 HMR bridge 导致递归调用，并在保留 ref 状态的同时让普通 setup 返回值跟随新代码刷新；同时补强 app/layout/page/bootstrap alias HMR 的 IDE 回归覆盖。
