---
'weapp-ide-cli': patch
---

修复微信开发者工具已登录时 `open` 被误判为登录失效的问题：已知项目路径时优先通过 HTTP `/open` 打开，HTTP 服务不可用时回退官方 CLI。
