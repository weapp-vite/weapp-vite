---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 的高频构建与 HMR 插件钩子补充 Rolldown hook filter，并跳过无页面特性提示的 wevu 页面脚本解析；同时在纯模板、样式、JSON 这类 asset-only HMR 中跳过 JS chunk 后处理，并复用已生成 wxss 内容跳过未变化样式资产写出，减少无关模块和样式文件进入写出尾段，提升增量更新体验。
