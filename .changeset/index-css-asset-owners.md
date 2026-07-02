---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 CSS 生成阶段的 owner 解析：在 generateBundle 开始时一次性建立 CSS asset 到入口 owner 的索引，避免每个样式 asset 都重复扫描整个 bundle chunk 列表，降低多入口、多样式项目在 build 与 HMR 收尾阶段的重复遍历成本。
