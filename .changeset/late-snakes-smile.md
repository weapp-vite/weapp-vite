---
"wevu": patch
"create-weapp-vite": patch
---

恢复 `wevu` 对外导出的 `WevuComponentConstructor` 类型别名，修复 lib 模式生成的声明文件在引用 `import("wevu").WevuComponentConstructor` 时出现的类型回归，避免 `e2e-apps/lib-mode` 与下游依赖 `wevu` 类型入口的项目在 `tsd`/类型检查阶段报错。
