---
"weapp-vite": patch
"create-weapp-vite": patch
---

按实际构建生命周期释放 Tailwind 编译器，修复开发模式下一次性 HMR 快照未释放编译资源、重复更新导致堆内存持续增长直至耗尽的问题。长期 watch 与开发服务器继续复用编译器，快照失败和正常关闭均等待资源释放完成。
