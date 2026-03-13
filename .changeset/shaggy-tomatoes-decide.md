---
'weapp-vite': patch
'create-weapp-vite': patch
---

修正自动路由默认扫描规则，不再把任意 `**/pages/**` 目录视为页面目录，而是只默认扫描主包 `pages/**` 与已声明分包 root 下的 `pages/**`，避免误匹配 `components/pages/**` 等非页面目录。
