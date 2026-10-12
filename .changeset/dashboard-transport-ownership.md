---
"weapp-vite": patch
"@weapp-vite/dashboard": patch
"create-weapp-vite": patch
---

fix(dashboard): 将仪表盘的 Hub 和 MCP 传输依赖交由可选 Dashboard 包安装，并从实际选中的 Dashboard 安装位置按需加载，保持现有仪表盘入口、认证及资源生命周期行为。
