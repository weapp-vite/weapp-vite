---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复多平台构建时 dist 输出与 project.config 同步路径不一致的问题，统一将 miniprogramRoot=dist 映射为 dist/<platform>/dist 并自动复制平台 project.config。
显式禁用 inlineDynamicImports 以避免 codeSplitting 下的警告。
