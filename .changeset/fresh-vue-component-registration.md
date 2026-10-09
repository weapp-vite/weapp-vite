---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 自动导入组件在文件时间戳未变化时仍复用旧配置的问题，确保文件更新后 `component` 配置的关闭与恢复正确刷新注册结果。
