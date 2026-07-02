---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 Vue 入口配置回退分析时已经读取的 SFC 源码，并合并 SFC transform 收尾阶段的 HMR signature 查询，减少 HMR 和构建入口加载中的重复读取与解析。
