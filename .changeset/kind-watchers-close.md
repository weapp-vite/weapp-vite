---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复状态保持 HMR 降级到 classic 首次构建期间关闭开发命令时的循环等待，确保监听器完成释放并恢复 IDE 私有配置。
