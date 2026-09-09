---
"weapp-vite": patch
"create-weapp-vite": patch
---

将状态保持 HMR 的孤立模块加载入口登记到应用启动代码，避免共享 runtime 与重导出 chunk 形成循环依赖，保留按需初始化能力与应用启动时的单向模块依赖。
