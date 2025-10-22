# 微信小程序插件开发

`weapp-vite` 已支持在同一个项目中同时维护主应用与插件代码。只需在配置里开启 `pluginRoot`，即可沿用现有的热更新、构建、调试能力。本页将介绍目录约定、开发命令以及如何借助示例项目快速上手。

::: tip TL;DR

1. 在 `vite.config.ts` 中设置 `weapp.pluginRoot` 指向插件目录。
2. 将 `plugin.json`、公共组件与页面放在该目录下，结构与官方要求保持一致。
3. 执行 `pnpm dev`/`pnpm build` 时，`dist/plugin/**` 会生成完整的插件包，可直接导入微信开发者工具或使用 `weapp-ide-cli` 上传。
   :::

## 开启插件目录

```ts [vite.config.mts]
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
    pluginRoot: 'plugin', // plugin.json 所在目录
  },
})
```

`pluginRoot` 可以是相对或绝对路径。`weapp-vite` 会：

- 读取该目录下的 `plugin.json`，自动根据 `main`、`publicComponents`、`pages` 等字段构建入口图；
- 监听插件目录中的 JS/WXML/WXSS 及配置文件，配合主应用实现热更新；
- 在构建阶段将插件产物输出到 `dist/plugin/**`，保持与原目录一致的层级。

若未设置 `pluginRoot`，则插件相关流程不会启用。

## 目录约定

以下是示例仓库（`apps/plugin-demo`）的插件目录结构，可作为参考：

```text
plugin
├── plugin.json
├── index.js           # 插件入口(main)
├── pages
│   └── hello-page
│       ├── hello-page.js
│       ├── hello-page.wxml
│       └── hello-page.wxss
└── components
    └── hello-component
        ├── hello-component.js
        ├── hello-component.json
        ├── hello-component.wxml
        └── hello-component.wxss
```

- 目录和文件命名与微信小程序插件规范完全一致；
- WXSS/WXML 会被在构建时复制到 `dist/plugin/**`，不会再污染源目录；
- 插件的静态资源（图片、字体等）建议放在插件目录下，`weapp-vite` 会一并复制。

## 开发流程

### 启动本地开发

```sh
# monorepo 场景下的示例（apps/plugin-demo）
pnpm --filter plugin-demo dev
# 或在独立项目中：
pnpm dev
```

- 主应用与插件会同时监听并增量构建。
- 插件入口产生的页面/组件同样支持热更新，输出目录为 `dist/plugin/**`。
- 可配合 `pnpm dev --open` 自动拉起微信开发者工具，进行真机或模拟器调试。

### 构建与上传

```sh
pnpm --filter plugin-demo build
```

构建完成后会看到类似结构：

```text
dist/
├── app.js
├── app.json
├── pages/…
└── plugin/
    ├── plugin.json
    ├── index.js
    ├── pages/hello-page/…
    └── components/hello-component/…
```

- 将 `dist` 目录作为项目根导入微信开发者工具即可预览；
- 若只需要上传插件，可根据微信官方要求打包 `dist/plugin` 内容；
- 也可以搭配 [`weapp-ide-cli`](../projects/weapp-ide-cli.md) 实现命令行上传/预览。

## 示例项目

仓库内置了完整示例，可直接参考或复制：

- 路径：`apps/plugin-demo`
- 主要文件：`plugin/plugin.json`、`plugin/components/hello-component/*`、`plugin/pages/hello-page/*`
- 封装了常用脚本：
  ```json
  {
    "scripts": {
      "dev": "weapp-vite dev",
      "dev:open": "weapp-vite dev -o",
      "build": "weapp-vite build",
      "open": "weapp-vite open"
    }
  }
  ```

运行 `pnpm --filter plugin-demo dev` 即可复现插件开发体验。

## 常见问题

### 插件 WXSS 没有生成？

- 检查是否升级到最新版本，并确认 `pluginRoot` 指向正确；
- 仅当插件目录存在对应的 `.wxss` 文件或从脚本中引用样式时，才会生成；
- 若文件名出现 `../plugin` 等路径，请升级至包含本修复的版本。

### 附加功能是否生效？

插件编译共享绝大部分能力：

- 自动构建 npm、WXML/WXSS 增强、auto-import 等功能均可在插件内使用；
- 如果某些能力需要额外配置（如自动导入组件），请在 `vite.config.ts` 或插件目录下的模块中参照主应用的写法。

如仍有疑问，可到 [社区交流群](/community/group) 反馈或查看示例仓库的实现。\*\*\*
