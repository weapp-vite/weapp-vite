---
"wevu": patch
"create-weapp-vite": patch
---

fix(wevu)：修复 runtime watch 停止句柄与注册流程的类型不一致问题，清理小程序全局对象与生命周期补丁的 TS 报错，并补全对外 API 的 tsd 与导出覆盖测试。
