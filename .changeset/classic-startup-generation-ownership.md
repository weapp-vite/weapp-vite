---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 在 classic 配置重启等待文件监听器就绪前登记新代资源归属，避免公共关闭与启动互相等待；保留就绪错误、清理错误及共享资源释放顺序。
