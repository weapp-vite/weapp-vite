---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复微信开发者工具从状态保持 HMR 回退到 classic 时的资产监听交接。

在首轮 classic 产物写完后恢复 IDE 资产监听，避免开发者工具在原生写出期间读取新旧混合产物。
