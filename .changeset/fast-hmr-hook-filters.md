---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 的高频构建与 HMR 插件钩子补充 Rolldown hook filter，并跳过无页面特性提示的 wevu 页面脚本解析；同时在模板、脚本、JSON 等非样式 HMR 中跳过共享样式后处理、复用已生成输出剔除未变化文件，并只在样式相关 HMR 后触发 app.wxss touch，减少无关模块和样式文件进入写出尾段，提升增量更新体验。

修复自动路由新增/删除和共享依赖更新时 HMR 输出白名单遗漏根入口与运行时 shared chunk 的问题，确保 app.js、运行时 chunk、typed-router 与页面产物在增量构建中同步写出。

复用源码未变化的 Vue SFC 编译缓存，避免 dev emit 刷新阶段重复编译页面入口，降低多平台模板 HMR 的增量等待时间。

修复自动路由拓扑变化后紧接 app.vue 宏更新时 app.js 可能复用旧 routes 快照的问题，确保 Windows 等文件事件顺序更敏感的平台也能稳定同步新增页面。

模板性能对比报告新增 build 峰值 RSS、HMR GC 后 heapUsed 与 RSS 指标，便于在同一份报告里同时观察构建耗时、增量更新耗时和内存占用变化。
