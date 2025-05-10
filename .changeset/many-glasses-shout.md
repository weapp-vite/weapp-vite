---
"weapp-vite": minor
---

feat: 重构微信小程序 `worker` 的处理策略

现在需要在 `vite.config.js` 中配置 `worker` 的路径，如：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    // ...
    worker: {
      entry: [
        // 不指定后缀，会去自动找 ts -> js
        'hello',
        // 指定后缀
        'index.ts',
        'other.js'
        // 此时 weapp-vite 会从你在 app.json 中设置的 workers.path 路径中去寻找打包入口
      ]
    }
  },
})
```

原先的策略是，直接默认以 app.json 中设置的 `workers.path` 所有的入口作为打包入口，发现存在问题，见 [#120](https://github.com/weapp-vite/weapp-vite/issues/120)