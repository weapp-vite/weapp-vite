---
"create-weapp-vite": patch
---

修复在 pnpm 工作区内创建非成员项目时错误继承父级 registry、认证与构建审批配置的问题，按成员匹配和排除规则确定项目的安装边界。
