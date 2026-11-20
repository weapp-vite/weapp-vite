---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复微信开发者工具从状态保持 HMR 回退到 classic 时的资产监听交接。

在 stateful 交接到 classic 时停用 IDE 局部脚本热载，并等待因配置变更重启的 AppService 确认已加载旧 App 和当前页面。首轮 classic 写出并清理旧产物后再恢复资产监听，避免 IDE 加载混合产物。
