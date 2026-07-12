---
"@wevu/web-apis": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 Web Runtime URL polyfill 解析自定义协议根路径时重复插入路径分隔符的问题，并让 installer 与 chunk 局部绑定统一校验宿主 URL 的相对路径语义，使 `URL` 构造器和 `URL.parse()` 的结果与 Web 标准行为保持一致。
