---
'create-weapp-vite': patch
'weapp-vite': patch
---

fix(weapp-vite): 补全自动模式请求全局对象的启动期识别，覆盖用户 app prelude 与业务 chunk 的实际使用，并同步默认依赖文档。
