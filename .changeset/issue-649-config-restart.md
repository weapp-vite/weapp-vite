---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 dev 模式下修改 Vite/weapp-vite 配置后开发构建卡在重启流程的问题。配置重载现在会保留运行时服务状态引用，跳过普通 HMR 成功日志，并在重启后继续响应后续文件变更。
