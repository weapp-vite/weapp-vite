---
"weapp-vite": patch
"create-weapp-vite": patch
---

feat: 完善支付宝示例与模板脚本模块兼容。

- 在 `apps/alipay-antd-mini-demo` 新增 wevu SFC 页面示例，并补充首页跳转入口。
- 修复支付宝模板脚本模块标签转换，统一输出 `import-sjs` 并映射 `from/name` 属性，避免开发者工具报 `<sjs>` 不存在。
- 同步完善 wxml/nmp builder 相关测试，覆盖支付宝脚本模块转换链路。
