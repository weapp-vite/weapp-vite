---
"wevu": patch
"create-weapp-vite": patch
---

压缩 wevu 的默认发布构建产物，减少小程序包中运行时代码的原始体积和压缩后体积，同时补充未压缩的调试产物，支持通过 development 条件导出和 wevu/debug 子路径切换到可读源码。
