---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Tailwind 内容热更新时模板类名已更新而样式仍停留在旧版本的问题。CSS 输出层保留尚待生成的样式入口，由最终生成阶段更新工具类，同时继续跳过未变化的普通样式。
