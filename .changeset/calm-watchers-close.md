---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 classic 开发模式在配置重启期间关闭 watcher 后仍创建新构建监听器的问题，关闭会等待并释放在途重启的资源。
