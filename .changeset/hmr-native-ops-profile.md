---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR entry emit 链路，避免同一轮递归发现时重复触发相同入口的 chunk emit，并在 HMR profile / analyze 摘要中补充 load、chunk emit 与已加载跳过次数，方便评估 JS 与 native 构建核心之间的通信成本。
