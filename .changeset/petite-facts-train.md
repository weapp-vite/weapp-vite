---
"weapp-vite": patch
---

feat: 优化分包 chunk 的策略

当一个模块全部被分包中的代码引入的场景下，这个模块会被打入到分包中。

当同时被分包，主包，或者其他分包使用的时候，这个会被打入到主包中去。

https://github.com/weapp-vite/weapp-vite/discussions/150