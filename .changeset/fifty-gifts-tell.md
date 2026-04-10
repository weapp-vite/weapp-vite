---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序构建中 `dependencies` 运行时依赖的 external 判定：不再把仅用于 npm 产物收集的候选依赖直接当作 bundler external，同时补上 builtin alias 绝对路径的 external 匹配。这样在 `wevu` 位于 `dependencies` 时，应用构建会稳定保留运行时依赖引用；仅位于 `devDependencies` 的包则不会被误判为运行时 external。
