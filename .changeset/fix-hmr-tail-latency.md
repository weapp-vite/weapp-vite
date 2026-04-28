---
"weapp-vite": patch
"create-weapp-vite": patch
---

收窄 direct HMR 对 source shared chunk 的大 fanout 扩散，并让 workspace HMR 审计优先使用 profile 延迟统计，降低 P90/P95 和最慢场景尾延迟。
