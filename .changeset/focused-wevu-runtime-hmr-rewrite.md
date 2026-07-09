---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 partial HMR 的 Wevu runtime rewrite 范围：运行时导入重写只扫描当前活跃 HMR 输出，同时保留完整 runtime chunk 索引，减少大型页面和 request-globals 场景下的重复扫描开销。
