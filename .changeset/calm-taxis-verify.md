---
"weapp-vite": patch
"create-weapp-vite": patch
"wevu": patch
---

修复支付宝小程序模板在最终产物归一化阶段会把 `import-sjs` 错误降级为 `sjs`、独立 SJS 被错误转换为 `module.exports` 的问题，并让 wevu 页面使用支付宝要求的 `Page()` 宿主契约注册，确保脚本模块和 Vue SFC 都能在真实运行时加载；同时补充原生页面、Vue SFC、wevu runtime、SJS、`antd-mini` 与官方 `minidev` 编译复验。
