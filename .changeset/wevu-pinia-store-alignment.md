---
"wevu": major
"create-weapp-vite": patch
"weapp-vite": patch
"@weapp-vite/eslint": patch
---

以 Pinia 4.0.3 对齐 Store 初始化、Setup 自动解包、深层 patch、重置、插件和生命周期。需显式安装 Pinia，Setup Store 自行实现 `$reset`；`$dispose` 保留状态，页面卸载自动取消普通订阅，在途 action 结果回调继续执行。同步自动导入、兼容诊断、示例与迁移文档。
