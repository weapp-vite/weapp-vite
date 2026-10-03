---
"weapp-vite": patch
"create-weapp-vite": patch
---

根据已编译的 Vue SFC 内容签名忽略没有语义变化的重复源码通知，避免脚本热更新后额外触发完整资源快照。显式 sidecar、外部依赖和自动路由变化仍正常失效，真实样式与混合编辑继续按对应更新路径交付。
