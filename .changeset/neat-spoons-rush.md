---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态 HMR 的 shared chunk / snapshot emit 路径，约束最终 dist 产物统一来自 Vite 或 Rolldown 的原生 emit/write，避免通过手动写文件生成构建输出，并补齐相关回归测试与流程约束。
