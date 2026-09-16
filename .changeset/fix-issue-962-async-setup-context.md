---
'wevu': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复异步 setup 执行结束后上下文泄漏导致后续组件生命周期注册失败的问题。
