---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一组件注册和入口加载使用的真实源文件身份，避免 Windows 短文件名与长路径混用时重复发射组件入口，并确保开发快照和 HMR 入口元数据使用一致的规范路径，同时保留打包器解析出的模块 ID。
