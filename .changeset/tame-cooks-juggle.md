---
'weapp-vite': patch
'weapp-ide-cli': patch
'create-weapp-vite': patch
---

修复并收敛小程序开发态的 DevTools 交互流程：`weapp-vite dev --open` 现在将 `r` 明确用于通知微信开发者工具重新编译，将手动重新构建产物调整为 `R`，并修复手动重建清空 `dist` 后 `app.json` 等关键产物未重新写回的问题；同时统一 IDE 打开、登录失效重试与终端按键输入协调逻辑，避免在微信开发者工具登录过期时出现热键监听、重试提示与重新编译动作互相干扰的情况。
