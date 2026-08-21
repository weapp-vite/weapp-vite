---
"wevu": patch
"@wevu/test-utils": patch
"create-weapp-vite": patch
---

隔离 `@wevu/test-utils` 每次组件挂载的应用上下文，避免 provide、插件、mocks 和卸载状态跨 wrapper 泄漏；同时允许测试页面目录内的普通组件，并支持自定义页面文件判定。
