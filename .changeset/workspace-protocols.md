---
"@weapp-core/init": patch
"@wevu/compiler": patch
"@wevu/web-apis": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
"weapp-ide-cli": patch
"weapp-vite": patch
"wevu": patch
---

统一公开包的 workspace 内部依赖发布策略，改为发布时写入精确版本，并补充仓库守卫防止内部依赖再次回退到宽松 range。
