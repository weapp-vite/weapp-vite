---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 WXS/SJS 生成阶段的 HMR 路径，普通脚本、样式、JSON 更新不再扫描完整模板 tokenMap，减少无关增量构建的固定开销。
