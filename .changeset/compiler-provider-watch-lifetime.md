---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复第三方编译插件的转换依赖未接入开发模块图和状态保持 HMR 输入账本的问题，并将 controller 的资源释放延迟到所属开发会话关闭，避免连续更新时提前 dispose。
