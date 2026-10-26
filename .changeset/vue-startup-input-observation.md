---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 统一 Vue 原始源码与共享样式的编译输入归属，并核验首构期间物理 sidecar 创建事件的来源、归属与已消费内容，避免迟到通知重复发布产物。共享样式沿用冻结输入及可选删除语义。
