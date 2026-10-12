---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): npm 本地化重写复用已解析的 AST，排除无匹配依赖的普通相对导入，减少无需改写的 chunk 上的 Babel 作用域构建。保留平台 API 收集、转义和正则依赖规则、Proxy 副作用及已本地化依赖的 interop 处理，未知节点或候选检查失败时仍走原重写流程。
