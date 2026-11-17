---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 压缩 ES5 最终产物时在同一次 SWC 降级中启用标识符重命名，避免压缩后注入的 helper 与 ES5 重写产生的标识符以完整名称逐 chunk 保留，导致 `weapp.es5` 产物明显膨胀。
