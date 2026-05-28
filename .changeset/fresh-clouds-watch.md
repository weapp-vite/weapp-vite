---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 dev/build 的 watch 行为：dev 模式会继承 `build.watch.include` 并响应配置依赖变更，生产 build 不再因为用户配置 `build.watch` 而进入监听模式。
