---
"@weapp-vite/web": patch
---

修复 `@weapp-vite/web` 在迁移到 `tsdown` 后发布产物调试体验退化的问题。默认构建现已显式关闭压缩、开启 sourcemap、关闭 hash 文件名并启用 unbundle 输出，避免入口文件退化为短别名转发到 hash chunk，提升运行时排障与源码追踪可读性。同时补充构建产物回归测试，锁定入口可读性与 sourcemap 产出。
