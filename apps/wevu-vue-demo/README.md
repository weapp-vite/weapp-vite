# WeVU Vue Demo

使用 `@weapp-vite/plugin-wevu` 自动把 `.vue` 单文件组件编译成微信小程序的多文件结构。

## 快速开始

```bash
pnpm install
pnpm --filter wevu-vue-demo dev
```

在首次运行前无需手动构建插件，脚本会自动执行 `pnpm --filter @weapp-vite/plugin-wevu build`。


运行后，插件会把 `src` 下的 `.vue` 按原目录结构编译到 `.wevu/src/`，生成 `app.ts / app.wxss / app.json` 以及页面的 `index.ts / index.wxml / index.wxss / index.json`，随后再由 weapp-vite 构建到 `dist/`，并同步热更新到微信开发者工具。`project.config.json` / `project.private.config.json` 直接复用了微信开发者工具默认结构，可按需自定义。

## 主要看点

- `src/app.vue` 验证了应用入口也可以用 `.vue` 维护，插件会自动拆分出 App 三件套并写入 `.wevu/src/app.*`。
- `src/pages/wevu/index.vue` 展示了 `data`、`computed`、`methods`、`watch` 等用法，验证页面级 `.vue` 的能力。
- `<config>` 自定义块自动编译成页面 `json` 配置。
- 通过 `@weapp-vite/volar` 获取 `<config>` 类型提示，基于 `@weapp-core/schematics` 自动校验字段。
- `src/pages/config-ts/index.vue` / `src/pages/config-js/index.vue` 示例了使用 TypeScript 或 JavaScript 编写 `<config>`，并由插件自动生成 JSON。
- `vite.config.ts` 挂载了 `wevuPlugin()`，无需额外手动生成产物。
