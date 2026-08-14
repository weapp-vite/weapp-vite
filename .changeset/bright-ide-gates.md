---
"weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/miniprogram-automator": patch
"create-weapp-vite": patch
---

修复插件模板在微信开发者工具自动化打开时被错误按小程序模式校验的问题，保留插件项目的 `compileType: "plugin"` 与 `version: "dev"` 开发配置；同时增强已打开 automator 会话的就绪检查、缺失 SDKVersion 兼容和 IDE E2E 分层入口，使 `e2e:ide:full` 默认执行核心高信号套件，完整逐文件回归保留在 `e2e:ide:full:exhaustive`。
