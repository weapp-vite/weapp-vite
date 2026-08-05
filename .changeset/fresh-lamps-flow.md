---
"weapp-vite": patch
---

修复 Vite 8 / Rolldown 1.2 下微信状态保持 HMR 的补丁注册与模块重执行流程，避免补丁定义被旧页面或组件注册覆盖。
