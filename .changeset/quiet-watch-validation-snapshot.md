---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 Vite watch 中配置扫描状态被并发失效时可能跳过 worker 入口校验的问题，始终校验本次扫描返回的配置，并在 app 产物收集时校验最新配置，阻止扫描后再次保存的非法 worker 配置进入产物。
