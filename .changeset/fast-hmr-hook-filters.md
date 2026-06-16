---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 的高频构建与 HMR 插件钩子补充 Rolldown hook filter，并跳过无页面特性提示的 wevu 页面脚本解析；同时在纯模板、样式、JSON 这类 asset-only HMR 中跳过 JS chunk 后处理，减少无关模块进入插件处理与写出尾段，提升增量更新体验。
