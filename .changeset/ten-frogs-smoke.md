---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复两处 CI 回归相关问题：一是同步 `github-issues` 中 request globals 构建产物断言到新的被动绑定注入形式；二是移除 `auto-routes` 生成类型里分包项 `root/pages` 的 `readonly` 限制，避免 `routes.subPackages` 直接传给 `defineAppJson()` 时在 `vue-tsc` 下出现类型不兼容。
