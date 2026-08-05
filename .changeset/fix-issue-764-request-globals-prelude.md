---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复默认 wevu 模板安装 axios 后真机调试可能白屏的问题：自动识别请求客户端依赖时默认提前生成 request globals app prelude，确保页面模块执行前已经安装 `fetch`、`XMLHttpRequest` 和 `URL` 等兼容全局对象。
