---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Windows 环境下 HMR 对侧车文件 `rename` 保存模式的识别问题。现在对于模板、样式、页面配置等文件的原子重命名保存以及连续快速修改，会在短暂 settle 后按已知文件状态正确判定为更新或删除，避免热更新丢失；同时补充了对应的 rename-save 与连续修改 CI 用例。
