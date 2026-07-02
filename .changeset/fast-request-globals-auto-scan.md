---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化请求全局对象自动注入的源码分析入口，明显无关的模块会在文本快速判断后跳过 Babel/SFC 解析，降低构建与 HMR 中 `weapp-vite:pre` 的无效 transform 成本。
