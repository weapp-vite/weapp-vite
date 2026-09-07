---
"@mpcore/simulator": patch
---

修复测试桥接 evaluate 无法读取应用全局状态的问题，统一使用当前小程序上下文，并随会话关闭清理测试函数创建的定时任务。
