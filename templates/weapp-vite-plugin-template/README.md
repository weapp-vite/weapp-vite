# weapp-vite-plugin-template

`weapp-vite` 小程序插件模板，内置宿主小程序、`pluginRoot` 和共享 TS 模块示例。

## 使用方式

### 开发

- `pnpm dev`
- `pnpm dev:open` 可以打包并直接启动微信开发者工具

### 构建

`pnpm build`

### Web 预览与构建

- `pnpm dev:web`
- `pnpm build:web`

### 打开微信开发者工具

`pnpm open`

## 目录说明

- `src/`: 宿主小程序源码
- `plugin/`: 插件源码，包含 `plugin.json`、公开组件与页面
- `shared/`: 主包与插件共享的 TypeScript 模块

## 使用提示

- 模板默认通过 `weapp.pluginRoot` 输出 `dist-plugin/**`
- 托管 TypeScript 配置默认包含 `src/` 和配置的 `pluginRoot`；模板通过 `weapp.typescript.app.include` 额外声明 `shared/`，新增共享源码目录时也应同步声明。
- `project.config.json` 使用 `compileType: "plugin"`，`src/app.json` 中的 `hello-plugin.version` 使用 `"dev"`，调试当前 `pluginRoot` 内的本地插件
- 插件产物由 `weapp-vite` 编译，项目设置 `setting.es6: false`，避免开发者工具重复 Babel 转译时生成越过插件根目录的 `@babel/runtime` helper 引用
- `src/app.json` 里预置了与插件 AppID 一致的 `hello-plugin.provider`
- 如果你要在自己的插件 AppID 下调试或上传，请先替换 `project.config.json` 的 `appid`，并同步修改 `src/app.json` 里的 `plugins.hello-plugin.provider`

## 文档地址

0. `weapp-vite`: https://vite.weapp.dev/
1. 插件开发说明: https://vite.weapp.dev/guide/plugin
