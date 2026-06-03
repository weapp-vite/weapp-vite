---
"@weapp-vite/web": patch
---

补齐 Web runtime 对 `rolldown` 的直接依赖声明，确保消费 `rolldown-require` 时在严格依赖解析和 CI 测试环境中可以稳定加载其 peer 依赖。
