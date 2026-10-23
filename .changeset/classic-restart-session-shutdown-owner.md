---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复热更新回退 classic 后在配置重载期间退出可能遗漏开发会话的问题。完整关闭始终等待当前会话及其在途重启，防止退出后重新创建文件监听器。
