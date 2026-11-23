---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复独立分包引用依赖包资源时的输出路径。

使用 `[subpackage]` 命名时，独立分包构建会将资源输出到包内，主包同时使用同一资源时仍有自己的可访问产物。
