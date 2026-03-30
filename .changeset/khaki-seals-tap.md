---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 monorepo 并行构建时 npm 依赖共享缓存目录的竞争问题。此前部分 workspace fixture 会把 `node_modules/weapp-vite/.cache/npm-source` 解析到同一个 `packages/weapp-vite` 实体目录，导致不同项目同时构建时互相覆盖缓存。现在共享 npm source cache 改为写入各项目自己的 `.weapp-vite/npm-source` 目录，避免跨项目串扰，并补充对应单测覆盖新的缓存路径解析。
