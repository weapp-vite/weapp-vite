---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `plugin-demo` 这类同时构建主小程序与插件的场景里，`app` 构建错误地把 `plugin.json` 里的插件入口纳入同一编译图、以及插件主入口导出在独立构建中被错误裁剪的问题。现在插件入口仅会在 `plugin` target 下单独解析与产出，`project.config.json` 指定的 `dist/` 与 `dist-plugin/` 会各自独立 emit 正确产物，不再共享不必要的 JS chunk，并且 `requirePlugin()` 可以正确拿到插件导出。
