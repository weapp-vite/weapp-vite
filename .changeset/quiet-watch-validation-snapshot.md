---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 Vite watch 中配置扫描状态被并发失效时可能跳过 worker 入口校验的问题，始终校验本次扫描返回的配置。
