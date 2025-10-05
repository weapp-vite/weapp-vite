---
"weapp-vite": minor
---

- feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
- test(weapp-vite): 增补 analyze 与 scan 服务的插件导出用例，覆盖子包场景
- chore(weapp-vite): CSS 插件使用 rolldown 导出的 Output 类型，保持运行时与类型来源一致
