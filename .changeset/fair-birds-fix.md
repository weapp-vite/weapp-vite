---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复插件独立构建场景下的 npm 产物输出与依赖重写逻辑。现在 `weapp-vite build` 在存在 `pluginRoot` 时会同时为插件产物构建 `miniprogram_npm`，并将插件 chunk / JSON 中的 npm 引用改写到插件本地输出目录，避免插件构建后只有 npm 目录而运行时代码仍保留裸包名引用的问题。同时补充 `apps/plugin-demo` 的 dayjs 演示，以及对应的单元测试与构建 e2e 覆盖。
