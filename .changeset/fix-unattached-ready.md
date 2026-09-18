---
"wevu": patch
"@mpcore/simulator": patch
"create-weapp-vite": patch
---

修复微信向未挂载的初始条件分支发送 ready 时误触发 Vue 补挂载的问题，并补齐模拟器对初始分支创建、替换和 ready 顺序的兼容。
