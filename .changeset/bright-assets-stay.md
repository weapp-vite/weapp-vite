---
"weapp-vite": patch
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

修复微信状态保持开发中静态资源变更触发 IDE 整页重编译、丢失页面状态的问题。开发会话临时接管输出资源的监听，资源仍由原生构建写出并可在运行时读取最新内容，关闭会话及下次构建前恢复用户配置。同时为 headless 模拟器补齐包内静态资源的实时读取，覆盖新增、编辑、删除和恢复场景。
