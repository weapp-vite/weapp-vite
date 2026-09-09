---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic HMR 复用 Vite 插件时 Tailwind 编译器在首轮构建后被提前释放的问题。编译器由现有开发控制器租约持有，最后一个控制器关闭时等待其释放；无控制器的一次性开发快照仍在构建结束时及时释放，避免恢复快照内存累积。
