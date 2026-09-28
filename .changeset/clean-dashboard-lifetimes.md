---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Dashboard Vite 适配器在重启和替换前资源校验失败时误释放控制器的问题，保留有效宿主的报告更新与读取，并在最终关闭时释放资源。
