---
"@wevu/web-apis": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

补齐 Web Runtime 的 File 兼容层，并让 FormData 的 append/set 支持文件名参数；weapp-vite 的请求全局被动绑定同步提供 File，避免第三方请求库在模块初始化阶段读取自由变量时缺少构造器。
