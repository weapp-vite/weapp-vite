---
"weapp-vite": minor
---

- feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
