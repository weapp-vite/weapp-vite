---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态 Tailwind content HMR 的触发范围：仅当 app 样式入口包含 Tailwind 相关声明时才刷新 app 样式，避免普通项目在工作区依赖命中 `weapp-tailwindcss` 时误重写无关 wxss 产物。
