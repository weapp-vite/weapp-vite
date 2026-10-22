---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复状态保持热更新完整重建或回退 classic 时旧样式编译池未释放的问题，在创建下一代编译池和关闭引擎前等待原生清理，避免开发命令退出时残留 Sass 子进程。
