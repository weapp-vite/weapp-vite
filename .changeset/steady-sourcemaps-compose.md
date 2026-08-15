---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复入口注入、请求运行时兼容、shared chunk 路径调整和构建后代码重写未完整组合 sourcemap 的问题，统一提交外部、hidden 与 inline 最终映射，避免生成代码行号偏移或映射越过原始源码范围。
