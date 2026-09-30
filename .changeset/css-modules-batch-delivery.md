---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue CSS Modules 更新被误判为纯样式变更的问题，使类名映射脚本与样式同批交付，避免后续脚本热更新或编译错误恢复时缺失样式模块并中断状态保持更新。
