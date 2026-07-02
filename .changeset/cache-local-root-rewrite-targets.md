---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化本地 npm 根路径重写逻辑，在同一轮 bundle 后处理中复用分包根匹配缓存，减少脚本与 JSON 产物重复线性匹配分包根的开销。
