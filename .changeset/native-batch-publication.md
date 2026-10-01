---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic HMR 同时保存 JS、WXML、WXSS 和 JSON 时遗漏样式或误删未变产物的问题。发布范围改由构建生命周期决定，样式仅在最终发布阶段去重，保留当前构建产物所有权以及用户自有文件。
