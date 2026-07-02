---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared style 生成阶段，`renderSharedStyleEntry` 返回预处理结果时同步带回原始样式源码，CSS 生成阶段复用该源码维护 import graph，避免同一个 shared style 文件在一次渲染后又被重复读取。
