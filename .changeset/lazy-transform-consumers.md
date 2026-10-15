---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 仅在存在可读取的 WXS 依赖或实际生成 stateful HMR 宿主模块时加载对应 Babel 转换依赖，减少未使用转换功能时的初始化开销。
