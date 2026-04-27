---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复静态资源复制扫描在使用 `fdir` 全路径遍历时无法匹配相对 glob 的问题，确保默认资源扩展名以及 `weapp.copy.include` / `weapp.copy.exclude` 配置继续生效。
