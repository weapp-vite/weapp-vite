---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(compiler): 按实际编译需求加载 JSX、WXML 和 WXS 转换依赖，减少普通项目构建与 HMR 的初始化工作；在同一同步处理阶段复用真实路径查询，保持模板产物、sourcemap、转换失败回退及跨轮次缓存边界兼容。
