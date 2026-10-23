---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 统一 Tailwind 与状态化 HMR 的文件输入捕获及原子保存核验，避免晚到的删除通知或短暂读取缺失撤销较新的源码输入；保留真实读取错误，并在来源订阅释放后停止未完成的捕获与更新通知。
