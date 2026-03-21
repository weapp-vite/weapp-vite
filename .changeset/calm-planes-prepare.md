---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `.weapp-vite` 托管 tsconfig 的 bootstrap 覆盖问题：当项目已经生成过带有实际 `vite.config.ts` 配置的支持文件时，启动 `weapp-vite dev` 不会再被轻量 bootstrap 回退成通用版本，也不会因此在每次启动时都误报“支持文件缺失或已过期”。
