---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序文件级热更新中 `auto-routes` 与 `layout` 链路的多余失效、全量重扫、删除窗口期误报与状态丢失问题，并收敛对应 e2e 断言到稳定的重构建信号。
