---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 npm 显式分类链路中的旧语义残留：miniprogram 构建的 external 判定与产物中的 npm 路径重写，统一改为基于 `npm.strategy = 'explicit'` 下的真实 npm 构建候选集，而不是继续把根 `dependencies` 当作默认运行时 npm 依赖。这样普通依赖无论写在 `dependencies` 还是 `devDependencies`，默认都会继续走 Vite 内联；只有小程序包或显式 `include` 的依赖才会进入 npm 构建与路径改写流程，同时 `legacy` 模式仍保持兼容。
