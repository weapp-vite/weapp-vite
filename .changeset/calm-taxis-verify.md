---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复支付宝小程序模板在最终产物归一化阶段会把 `import-sjs` 错误降级为 `sjs`、独立 SJS 被错误转换为 `module.exports` 的问题，确保脚本模块继续使用支付宝支持的 `from`、`name` 与 `export default` 契约，并补充原生页面、Vue SFC、wevu runtime、SJS、`antd-mini` 与官方 `minidev` 编译复验。
