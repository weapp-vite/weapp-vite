---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 按实际命令执行加载构建、上传、IDE、MCP 与分析实现，使命令注册及对应帮助和参数校验阶段避免提前初始化这些功能依赖。
