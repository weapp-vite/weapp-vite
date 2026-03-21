---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 Vue layout 页面注入导致的运行时注册时机错误：页面布局转换不再为 Vue layout 额外注入副作用 import，避免 layout 组件被提前打进 `common.js` 并在应用初始化之后才调用构造函数；同时补充源码单测、模板构建集成测试与微信开发者工具运行时 e2e，覆盖 layout 资源产物与无错误启动场景。
