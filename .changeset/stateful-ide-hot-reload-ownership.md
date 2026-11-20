---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 防止微信开发者工具在状态保持 HMR 回退时提前重启 AppService。

开发会话启动时暂时关闭 IDE 的局部脚本热重载，并继续按用户原来的设置选择 HMR 模式。回退到 classic 时沿用该设置，避免 IDE 在首轮产物发布前编译旧模块，退出时恢复用户的设置。
