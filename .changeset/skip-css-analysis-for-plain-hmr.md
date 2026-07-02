---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化非样式 HMR 的 CSS 插件生成阶段，在确认没有样式输出时跳过完整 style analysis，减少脚本和模板更新的固定扫描成本。
