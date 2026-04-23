'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `injectRequestGlobals` 与 `appPrelude` 联用时的 IDE 运行时模块装载问题。现在会避免把 request-globals support chunk 继续拆成额外共享模块，而是折叠回 `request-globals-runtime.js` 并统一改写相关引用，避免微信开发者工具在主包运行时出现 `module "... is not defined"` 的异常日志；同时补充了 request-globals 共享绑定注入与构建产物形态的回归测试，防止后续再次回退到不稳定的 chunk 结构。
