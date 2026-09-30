---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv build --upload --bump` 在配置求值后才更新版本的问题，保证配置与编译产物读取相同的新版本；配置选择纯 Web 时恢复本地清单及 npm 锁文件。
