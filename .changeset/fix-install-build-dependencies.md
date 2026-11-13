---
"weapp-vite": patch
---

fix(weapp-vite): 补齐模板依赖分析直接使用的 @vue/compiler-core 运行时依赖，避免依赖提升缺失时 CLI 和下游构建无法启动。
