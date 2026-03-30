---
"weapp-vite": patch
"create-weapp-vite": patch
---

移除 `loadViteConfigFile` 中把 `weapp-vite/*` 子路径导入重写到当前仓库 `packages/weapp-vite/dist/*` 的内部耦合逻辑，避免源码实现绑定 monorepo 目录结构。现在配置加载不再依赖仓库内绝对路径，行为更接近已发布包的真实解析方式。
