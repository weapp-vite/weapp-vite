---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): Tailwind 开发更新复用完整内存候选输入的编译引擎，并在所有磁盘生成入口统一处理延迟失效，避免首次普通内容保存重复重建，同时保持完整重同步和依赖更新的缓存正确性。删除样式入口和关闭编译器时同步释放对应的 HMR root 与待失效状态。
