# weapp-vite-plugin-template

`weapp-vite` 小程序插件模板，内置宿主小程序、`pluginRoot` 和共享 TS 模块示例。

## 使用方式

### 开发

- `pnpm dev`
- `pnpm dev:open` 可以打包并直接启动微信开发者工具

### 构建

`pnpm build`

### 打开微信开发者工具

`pnpm open`

## 目录说明

- `miniprogram/`: 宿主小程序源码
- `plugin/`: 插件源码，包含 `plugin.json`、公开组件与页面
- `shared/`: 主包与插件共享的 TypeScript 模块

## 使用提示

- 模板默认通过 `weapp.pluginRoot` 输出 `dist-plugin/**`
- `miniprogram/app.json` 里预置了 `hello-plugin` 的 `provider`
- 如果你要在自己的插件 AppID 下调试或上传，请先替换 `project.config.json` 的 `appid`，并同步修改 `miniprogram/app.json` 里的 `plugins.hello-plugin.provider`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. 插件开发说明: https://vite.icebreaker.top/guide/plugin
