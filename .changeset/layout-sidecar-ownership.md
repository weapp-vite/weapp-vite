---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复共享原生布局的逻辑入口误用父页面 JSON、模板及组件声明的问题，按实际布局源码身份读取侧车配置，保持重复构建的依赖归属稳定。
