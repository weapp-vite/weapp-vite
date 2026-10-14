---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 减少 stateful HMR 快照加载 Vue 和 app 入口时不必要的入口归属与真实路径查询，并在同一次内置别名解析中复用包根目录，避免各子入口重复读取包元数据。保持固定源码、原生入口、逐入口文件检查和资产校验语义；包根目录不跨解析调用保留。
