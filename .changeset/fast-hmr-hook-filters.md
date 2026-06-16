---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 的高频构建与 HMR 插件钩子补充 Rolldown hook filter，并跳过无页面特性提示的 wevu 页面脚本解析；同时在模板、脚本、JSON 等非样式 HMR 中跳过共享样式后处理、复用已生成输出剔除未变化文件，并只在样式相关 HMR 后触发 app.wxss touch，减少无关模块和样式文件进入写出尾段，提升增量更新体验。
