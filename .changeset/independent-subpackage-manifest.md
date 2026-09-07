---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一分包扫描与 app.json 生成时的独立分包配置，确保通过 weapp.subPackages 启用的独立分包在宿主中按相同方式加载，并保留 app.json 显式 independent 配置的优先级。
