---
'@wevu/web-apis': patch
---

修复小程序请求全局安装在原生运行时中的兼容性问题：现在会跳过 `null` 宿主、对拒绝写入的宿主安全降级，并稳定同步实际全局注册表，避免 `installRequestGlobals()` / `injectRequestGlobals` 场景下出现 `Cannot set property 'fetch' of undefined`，同时提升 IDE e2e 中共享 DevTools 会话切页的稳定性。
