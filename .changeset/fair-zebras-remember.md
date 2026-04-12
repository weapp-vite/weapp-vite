---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 request globals 默认自动注入在按需模式下的多处边界场景。现在会同时识别源码中的自由变量引用、常见请求库导入，以及构建后 shared chunk 中的 websocket 线索，按需补齐 `fetch`、`XMLHttpRequest`、`WebSocket`、`URL` 等关联全局对象；同时避免把仅存在于 `<script setup>` 中的源码级注入错误地下沉进 `setup()`，并在无法静态确定 installer 导出名时回退到运行时解析，确保 `socket.io-client` 与 request-globals 页面在真实小程序构建产物里仍能拿到顶层局部绑定。
