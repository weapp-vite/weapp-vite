---
"@mpcore/simulator": patch
"weapp-ide-cli": patch
---

修复 Component 页面同时声明 pageLifetimes 与顶层页面生命周期时的重复回调，并登记外部 automator bridge 会话以便 CLI 安全复用。
